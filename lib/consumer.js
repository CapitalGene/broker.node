'use strict';
var _ = require('lodash');
var Promise = require('bluebird');
var Exchange = require('./exchange');
var Queue = require('./queue');
var Connection = require('./connection');
var Message = require('./message');
var uuid = require('node-uuid');
var events = require('events');
var inherits = require('util').inherits;
var debug = require('debug')('broker:Consumer');
/**
 * Message consumer.
 *
 * @param {Object} options [description]
 * @param {Channel} options.channel The connection/channel to use for
 *                                  this consumer.
 * @param {Array} options.queues A single `Queue`, or a list of queues
 *                               to consume from.
 * @param {Boolean} options.noAck Flag for automatic message acknowledgment.
 *                                If enabled the messages are automatically
 *                                acknowledged by the broker.
 *                                This can increase performance but means
 *                                that you have no control of when the
 *                                message is removed.  Disabled by default.
 *                                @default false
 *
 * @param {Function} options.messageHandler `function(message)`
 *                                          Optional function called whenever
 *                                          a message is received.
 *                                          When defined this function will be
 *                                          called instead of the `receive`
 *                                          method, and `callbacks` will be
 *                                          disabled.
 *
 *                                          So this can be used as an
 *                                          alternative to :attr:`callbacks`
 *                                          when you don't want the body to
 *                                          be automatically decoded.
 *                                          Note that the message will still
 *                                          be decompressed if the message has
 *                                          the ``compression`` header set.
 *
 *                                          The signature of the callback
 *                                          must take a single argument,
 *                                          which is the raw message object
 *                                          (a subclass of `Message`).
 *
 *                                          Also note that the ``message.body``
 *                                          attribute, which is the raw
 *                                          contents of the message body, may
 *                                          in some cases be a read-only
 *                                          `buffer` object.
 *
 * @param {Boolean} options.autoDeclare By default all entities will be
 *                                      declared at instantiation, if you
 *                                      want to handle this manually you can
 *                                      set this to :const:`False`.
 *
 */
var Consumer = function (options) {
  options = options || {};
  this.channel = options.channel;
  this.queues = options.queues || [];
  this.noAck = _.isBoolean(options.noAck) ? options.noAck : false;
  this.messageHandler = options.messageHandler;
  this.autoDeclare = _.isBoolean(options.autoDeclare) ? options.autoDeclare : true;
  var self = this;
  if (this.autoDeclare) {
    this.queues = _.reduce(this.queues, function (result, queue) {
      result.push(queue.use(self.channel));
      return result;
    }, []);
  }
  debug('.constructor', 'queues', this.queues.length);
  this._activeTags = {};
  events.EventEmitter.call(this);
};

inherits(Consumer, events.EventEmitter);

/**
 * Revive consumer after connection loss.
 *
 * @param  {[type]} channel [description]
 * @return {[type]}         [description]
 */
Consumer.prototype.revive = function (channel) {
  // body...
};

/**
 * Declare queues, exchanges and bindings.
 *
 * This is done automatically at instantiation if :attr:`auto_declare`
 * is set.
 *
 * @return {[type]} [description]
 */
Consumer.prototype.declare = function () {
  debug('declare');
  var self = this;
  var declaringQueues = [];
  _.forEach(self.queues, function (queue) {
    declaringQueues.push(queue.declare());
  });
  return Promise.all(declaringQueues);
};

/**
 * Add a queue to the list of queues to consume from.
 *
 * This will not start consuming from the queue, for that you will
 * have to call :meth:`consume` after.
 *
 * @param {Queue} queue [description]
 */
Consumer.prototype.addQueue = function (queue) {
  if (this.autoDeclare) {
    queue = queue.use(this.channel);
    this.queues.push(queue);
  }
  return queue.declare();
};


/**
 * Start consuming messages.
 *
 * Can be called multiple times, but note that while it will consume
 * from new queues added since the last call, it will not cancel
 * consuming from removed queues ( use `cancel_by_queue`).
 *
 * @param  {[type]} options [description]
 * @param  {[type]} options.noAck [description]
 * @return {[type]}         [description]
 */
Consumer.prototype.consume = function (options) {
  debug('consume');
  var self = this;
  options = options || {};
  options.noAck = _.isBoolean(options.noAck) ? options.noAck : this.noAck;
  var consuming = [];
  _.forEach(this.queues, function (queue) {
    consuming.push(self._basicConsume(queue, null, options));
  });
  debug('consume', consuming.length);
  return Promise.all(consuming);
};

/**
 * [basicConsume description]
 * @param  {[type]} queue       [description]
 * @param  {[type]} consumerTag [description]
 * @param  {[type]} options     [description]
 * @param  {Boolean} options.noAck [description]
 * @return {[type]}             [description]
 */
Consumer.prototype._basicConsume = function (queue, consumerTag, options) {
  var self = this;
  options = options || {};
  var tag = this._activeTags[queue.name];
  debug('_basicConsume', '_activeTags[name]', tag);
  if (!tag) {
    // not currently consuming
    tag = this._addTag(queue, consumerTag);
    return queue.consume({
        consumerTag: tag,
        noAck: options.noAck,
        callback: self.receive.bind(self)
      })
      .then(function (result) {
        debug('_basicConsume', 'result', result, 'tag', tag);
        return tag;
      });
  }
};

Consumer.prototype._addTag = function (queue, consumerTag) {
  if (!consumerTag) {
    consumerTag = uuid.v4();
  }
  this._activeTags[queue.name] = consumerTag;
  return consumerTag;
};

/**
 * End all active queue consumers.
 *
 * This does not affect already delivered messages, but it does
 * mean the server will not send any more messages for this consumer.
 *
 * @return {[type]} [description]
 */
Consumer.prototype.cancel = function () {
  var self = this;
  return this.channel
    .then(function (channel) {
      var cancelings = [];
      _.forEach(self._activeTags, function (value, key) {
        cancelings.push(channel.cancel(value));
      });
      return Promise.all(cancelings);
    });
};

/**
 * Cancel consumer by queue name.
 *
 * @description use `Channel_Model.cancel(consumerTag)`
 *
 * @param  {String} queue [description]
 * @return {[type]}       [description]
 */
Consumer.prototype.cancelByQueue = function (queue) {
  var tag = this._activeTags[queue.name];
  delete this._activeTags[queue.name];
  if (tag) {
    return this.channel
      .then(function (channel) {
        return channel.cancel(tag);
      });
  }
};

/**
 * Return :const:`True` if the consumer is currently
 * consuming from queue'.
 *
 * @param  {[type]}  queue [description]
 * @return {Boolean}       [description]
 */
Consumer.prototype.isConsumingFrom = function (queue) {
  if (queue instanceof Queue) {
    queue = queue.name;
  }
  return !!this._activeTags[queue];
};

/**
 * Purge messages from all queues.
 *
 * @warning   This will *delete all ready messages*, there is no
 *            undo operation.
 *
 * @return {[type]} [description]
 */
Consumer.prototype.purge = function () {
  // body...
};

/**
 * Method called when a message is received.
 *
 * This dispatches to the registered :attr:`callbacks`.
 *
 * @param  {Message} message The `Message` instance.
 * @return {[type]}         [description]
 */
Consumer.prototype.receive = function (message) {
  if (message === null) {
    debug('receive', 'null message');
    return;
  }
  debug('receive', 'consumerTag', message.fields ? message.fields.consumerTag : null);
  var parsedMessage = Message.fromRawMessage(message);
  parsedMessage.channel = this.channel;
  this.emit('message', parsedMessage);
  if (_.isFunction(this.messageHandler)) {
    debug('receive', 'messageHandler');
    this.messageHandler(parsedMessage);
  }
};

module.exports = Consumer;
