'use strict';
/**
 * Queue
 *
 * @author Chen Liang [code@chen.technology]
 */

var Promise = require('bluebird');
var Exchange = require('./exchange');
var _ = require('lodash');
var Message = require('./message');
var debug = require('debug')('broker:queue');

/**
 * A Queue declaration.
 *
 * @param {Object} options
 * @param {String} options.name Name of the queue. Default is no name
 *                              (default queue destination).
 * @param {Exchange} options.exchange The `Exchange` the queue binds to.
 * @param {String} options.routingKey The routing key (if any), also called
 *                                    *binding key*.
 *                                    The interpretation of the routing key
 *                                    depends on the `Exchange.type`.
 *                                    * direct exchange
 *                                    * * Matches if the routing key property
 *                                        of the message and the `routing_key`
 *                                        attribute are identical.
 *                                    * fanout exchange
 *                                    * * Always matches, even if the binding
 *                                        does not have a key.
 *                                    * topic exchange
 *                                    * * Matches the routing key property of
 *                                        the message by a primitive pattern
 *                                        matching scheme. The message routing
 *                                        key then consists of words separated
 *                                        by dots (`"."`, like domain names),
 *                                        and two special characters are
 *                                        available; star (`"*"`) and hash
 *                                        (`"#"`). The star matches any word,
 *                                        and the hash matches zero or more
 *                                        words. For example `"*.stock.#"`
 *                                        matches the routing keys `"usd.stock"`
 *                                        and `"eur.stock.db"` but not
 *                                        `"stock.nasdaq"`.
 * @param {Channel} options.channel The channel the Queue is bound to (if bound).
 * @param {[{exchange,routingKey}]} options.bindings  [description]
 * @param {Boolean} options.durable Durable queues remain active when a server
 *                                  restarts. Non-durable queues
 *                                  (transient queues) are purged if/when
 *                                  a server restarts. Note that durable
 *                                  queues do not necessarily hold persistent
 *                                  messages, although it does not make sense
 *                                  to send persistent messages to a transient
 *                                  queue.
 *                                  @default true
 * @param {Boolean} options.exclusive Exclusive queues may only be consumed
 *                                    from by the current connection.
 *                                    Setting the 'exclusive' flag always
 *                                    implies 'auto-delete'.
 *                                    @default false
 * @param {Boolean} options.autoDelete If set, the queue is deleted when all
 *                                     consumers have finished using it.
 *                                     Last consumer can be cancelled either
 *                                     explicitly or because its channel is
 *                                     closed. If there was no consumer ever
 *                                     on the queue, it won't be deleted.
 * @param {Object} options.queueArguments Additional arguments used when
 *                                        declaring the queue.
 * @param {Object} options.bindingArguments Additional arguments used when
 *                                          binding the queue.
 * @param {Function} options.onDeclared Optional callback to be applied when
 *                                      the queue has been declared
 *                                      (the ``queue_declare`` operation
 *                                      is complete). This must be a function
 *                                      with a signature that accepts at least
 *                                      3 positional arguments:
 *                                      ``(name, messages, consumers)``.
 *
 * @param {[type]} [varname] [description]
 */
var Queue = function (options) {
  this.name = options.name;
  this.exchange = options.exchange;
  this.routingKey = options.routingKey;
  this.channel = options.channel;
  this.durable = options.durable;
  this.exclusive = options.exclusive;
  this.autoDelete = options.autoDelete;
  if (this.exclusive === true) {
    this.autoDelete = true;
  }
  this.queueArguments = options.queueArguments;
  this.bindingArguments = options.bindingArguments;
  this.bindings = options.bindings || {};
  this.onDeclared = options.onDeclared;
};

/**
 * Create a new `Queue` with the same configuration of this `Queue` with
 * a new `channel`
 *
 * @param  {[type]} channel [description]
 * @return {[type]}         [description]
 */
Queue.prototype.use = function (channel) {
  var newQueue = new Queue(this);
  newQueue.channel = channel;
  return newQueue;
};

Queue.prototype.setChannel = function (channel) {
  this.channel = channel;
};

Queue.prototype.getOptions = function (options) {
  options = options || {};
  return {
    exclusive: this.exclusive,
    durable: this.durable,
    autoDelete: this.autoDelete,
    arguments: this.queueArguments,
    passive: options.passive,
    nowait: options.nowait
  };
};

Queue.prototype.bind = function (channel) {
  // body...
};

/**
 * Declares the queue, the exchange and binds the queue to the exchange.
 *
 * @param  {Object} options
 * @param  {Boolean} options.nowait [description]
 *
 * @return {[type]}         [description]
 */
Queue.prototype.declare = function (options) {
  var self = this;
  var progress;
  if (self.exchange) {
    if (!self.exchange.channel) {
      // debug('#declare', 'exchane nochannel', self.channel);
      self.exchange = self.exchange.use(self.channel);
      // debug('#declare', 'exchane nochannel', self.exchange);
    }
    progress = self.exchange.declare(options);
  } else {
    progress = Promise.resolve();
  }
  return progress.then(function () {
      return self.queueDeclare(options);
    })
    .then(function () {
      return self.queueBind(options);
    })
    .then(function () {
      if (self.bindings.length > 0) {
        var extraBindings = [];
        _.forEach(self.bindings, function (binding) {
          if (!binding.exchange.channel) {
            binding.exchange = binding.exchange.use(self.channel);
          }
          extraBindings.push(self.bindTo(binding));
        });
        return Promise.all(extraBindings);
      }
      return Promise.resolve();
    });
};


/**
 * Declare queue on the server.
 *
 * @param  {[type]} options [description]
 * @param  {Boolean} options.nowait Do not wait for a reply.
 *                                  @default false
 * @param  {Boolean} options.passive If set, the server will not create the
 *                                   queue. The client can use this to check
 *                                   whether a queue exists without modifying
 *                                   the server state.
 *                                   @default false
 * @return {[type]}         [description]
 */
Queue.prototype.queueDeclare = function (options) {
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.assertQueue(self.name, self.getOptions(options));
    });
};

/**
 * Check if queue exists on the server
 *
 * @param  {[type]} queue [description]
 * @return {Promise.resolve}       exist
 * @return {Promise.reject} not exist
 */
Queue.prototype.checkQueue = function (queue) {
  if (!queue) {
    queue = this.name;
  }
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.checkQueue(queue);
    });
};

/**
 * Create the queue binding on the server.
 *
 * @param  {Object} options
 * @param  {Boolean} options.noWait [description]
 *                                  @default false
 * @return {[type]}         [description]
 */
Queue.prototype.queueBind = function (options) {
  options = options || {};
  return this.bindTo({
    exchange: this.exchange,
    routingKey: this.routingKey,
    arguments: this.bindingArguments
  });
};

/**
 * bind the queue to
 *
 * channel.bindQueue(queue, source, pattern, argt);
 *
 * @param  {[type]} channel [description]
 * @param  {[type]} options [description]
 * @param  {Exchange} options.exchange [description]
 * @param  {String} options.routingKey [description]
 * @param  {Object} options.arguments [description]
 * @param  {Boolean} options.nowait [description]
 *
 * @return {[type]}         [description]
 */
Queue.prototype.bindTo = function (options) {
  var name = this.name;
  var exchange = (options.exchange instanceof Exchange) ?
    options.exchange.name : options.exchange;
  var routingKey = options.routingKey;
  debug('bindTo', name, exchange, routingKey);
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.bindQueue(name, exchange, routingKey, options.arguments);
    });
};

/**
 * Create message instance to be sent with :meth:`publish`.
 *
 * @param {Object} body    Message body.
 *
 * @param {[type]} options [description]
 * @param {Number} options.deliveryMode Set custom delivery mode.
 *                                      Defaults to :attr:`delivery_mode`.
 * @param {Object} options.properties   Message properties.
 * @param {Object} options.headers      Message headers.
 */
Queue.prototype.Message = function (body, options) {
  options = options || {};
  var properties = options.properties || {};
  var headers = options.headers || {};
  var deliveryMode = _.has(options, 'deliveryMode') ? options.deliveryMode : this.deliveryMode;
  return new Message({
    body: body,
    headers: headers,
    properties: properties,
    deliveryMode: deliveryMode
  });
};

/**
 * Publish a `Message` to the queue
 *
 * @param  {Message} message [description]
 * @return {[type]}         [description]
 */
Queue.prototype.publish = function (message) {
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.sendToQueue(
        self.name, message.encode(), message.getPublishOptions());
    });
};

/**
 * Poll the server for a new message.
 *
 * Must return the message if a message was available,
 * or :const:`null` otherwise.
 *
 * This method provides direct access to the messages in a
 * queue using a synchronous dialogue, designed for
 * specific types of applications where synchronous functionality
 * is more important than performance.
 *
 * @param  {[type]} options [description]
 * @param  {Boolean} options.noAck If enabled the broker will automatically
 *                                ack messages.
 *                                @default false
 * @param  {Array} options.accept Custom list of accepted content types.
 * @return {[type]}         [description]
 */
Queue.prototype.get = function (options) {
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.get(self.name, options)
        .then(function (message) {
          return Message.fromRawMessage(message);
        });
    });
};

/**
 * Remove all ready messages from the queue.
 *
 * @param  {Object} options [description]
 * @param  {Boolean} options.nowait [description]
 *                                  @default false
 * @return {[type]}         [description]
 */
Queue.prototype.purge = function (options) {
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.purgeQueue(self.name);
    });
};

/**
 * Start a queue consumer.
 *
 * Consumers last as long as the channel they were created on, or until
 * the client cancels them.
 *
 * @param  {Object} options
 * @param  {String} options.consumerTag Unique identifier for the consumer.
 *                                      The consumer tag is local to a
 *                                      connection, so two clients can use
 *                                      the same consumer tags. If this field
 *                                      is empty the server will generate a
 *                                      unique tag.
 *                                      @default ''
 * @param  {Boolean} options.noAck If enabled the broker will automatically
 *                                 ack messages.
 *                                 @default false
 * @param  {Boolean} options.nowait Do not wait for a reply.
 *                                  @default false
 * @param  {Function} options.callback callback called for each delivered
 *                                     message
 *
 * @return {[type]}         [description]
 */
Queue.prototype.consume = function (options) {
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.consume(self.name, options.callback, {
        consumerTag: options.consumerTag,
        noAck: options.noAck
      });
    });
};

/**
 * Cancel a consumer by consumer tag.
 *
 * @param  {String} consumerTag [description]
 * @return {[type]}             [description]
 */
Queue.prototype.cancel = function (consumerTag) {
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.cancel(consumerTag);
    });
};

/**
 * Delete the queue.
 *
 * @param  {Object} options
 * @param  {Boolean} options.ifUnused If set, the server will only delete the
 *                                    queue if it has no consumers. A channel
 *                                    error will be raised if the queue has
 *                                    consumers.
 *                                    @default false
 * @param  {Boolean} options.ifEmpty If set, the server will only delete the queue
 *                                   if it is empty. If it is not empty a channel
 *                                   error will be raised.
 *                                   @default false
 * @param  {Boolean} options.nowait  Do not wait for a reply.
 *                                   @default false
 * @return {[type]}         [description]
 */
Queue.prototype.delete = function (options) {
  options = options || {};
  var self = this;
  if (!this.channel){
    return Promise.reject(new Error('no channel to use'));
  }
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.deleteQueue(self.name, {
        ifUnused: options.ifUnused,
        ifEmpty: options.ifEmpty
      });
    });
};

/**
 * Unbind queue by deleting the binding from the server.
 *
 * @param  {[type]} options [description]
 * @param  {[type]} options.nowait [description]
 * @param  {[type]} options.arguments [description]
 *
 * @return {[type]}         [description]
 */
Queue.prototype.queueUnbind = function (options) {
  options = options || {};
  var self = this;
  return this.unbindFrom({
    exchange: self.exchange,
    routingKey: self.routingKey,
    arguments: options.arguments,
    nowait: options.nowait
  });
};

/**
 * Unbind queue by deleting the binding from the server.
 *
 * @param  {[type]} options [description]
 * @param  {Exchange|String} options.exchange [description]
 * @param  {String} options.routingKey [description]
 * @param  {Object} options.arguments [description]
 * @param  {Boolean} options.nowait [description]
 *
 * @return {[type]}         [description]
 */
Queue.prototype.unbindFrom = function (options) {
  options = options || {};
  var self = this;
  var exchange = (options.exchange instanceof Exchange) ?
    options.exchange.name : options.exchange;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.unbindQueue(
        self.name,
        exchange,
        options.routingKey,
        options.arguments);
    });
};

module.exports = Queue;
