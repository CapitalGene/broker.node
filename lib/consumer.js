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
 *
 * @param {Function} options.messageHandler Optional function called whenever
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
 */
var Consumer = function (options) {
  options = options || {};
  this.channel = options.channel;
  this.queues = options.queues || [];
  this.noAck = _.isBoolean(options.noAck) ? options.noAck : false;
  this.messageHandler = options.messageHandler;
  this._activeTags = {};
  events.EventEmitter.call(this);
};

inherits(Consumer, events.EventEmitter);

Consumer.prototype.setChannel = function (channel) {
  this.channel = channel;
};

Consumer.prototype.getChannel = Promise.method(function () {
  return this.channel;
});

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
  var self = this;
  var declaringQueues = [];
  _.forEach(self.queues, function (queue) {
    queue.channel = self.channel;
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
  queue.channel = this.channel;
  return queue.declare();
};


/**
 * [consume description]
 * @param  {[type]} options [description]
 * @param  {[type]} options.noAck [description]
 * @return {[type]}         [description]
 */
Consumer.prototype.consume = function (options) {
  var self = this;
  options = options || {};
  options.noAck = _.isBoolean(options.noAck) ? options.noAck : this.noAck;
  var consuming = [];
  _.forEach(this.queues, function (queue) {
    consuming.push(self._basicConsume(queue, null, options));
  });
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
  if (!tag) {
    tag = this._addTag(queue, consumerTag);
    return queue.consume({
        consumerTag: consumerTag,
        noAck: options.noAck,
        callback: self.receive.bind(self)
      })
      .then(function () {
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
  var parsedMessage = Message.fromRawMessage(message);
  parsedMessage.channel = this.channel;
  this.emit('message', message);
};

module.exports = Consumer;
