'use strict';
/**
 * Exchange
 *
 * User to define an exchange
 *
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var Promise = require('bluebird');
var _ = require('lodash');
var Message = require('./message');
var inherits = require('util').inherits;


var TRANSIENT_DELIVERY_MODE = 1;
var PERSISTENT_DELIVERY_MODE = 2;

var defaultOptions = {
  name: '',
  type: 'direct',
  durable: true,
  autoDelete: false,
  passive: false,
  deliveryMode: PERSISTENT_DELIVERY_MODE,
};

/**
 * An Exchange declaration.
 *
 * @param {[type]} options [description]
 * @param {[type]} options.name Name of the exchange.
 *                              Default is no name (the default exchange).
 * @param {[type]} options.type direct, topic, fanout, headers
 * @param {[type]} options.channel The channel the exchange is
 *                                 bound to (if bound).
 * @param {[type]} options.durable Durable exchanges remain active when a
 *                                 server restarts. Non-durable exchanges
 *                                 (transient exchanges) are purged when
 *                                 a server restarts. Default is `true`.
 * @param {[type]} options.autoDelete If set, the exchange is deleted when
 *                                    all queues have finished using it.
 *                                    Default is `false`.
 * @param {[type]} options.deliveryMode The default delivery mode used for
 *                                      messages. The value is an integer,
 *                                      or alias string.
 *                                      * 1 or `"transient"`
 *                                      The message is transient. Which means
 *                                      it is stored in memory only, and is
 *                                      lost if the server dies or restarts.
 *
 *                                      * 2 or "persistent" (*default*)
 *                                      The message is persistent. Which means
 *                                      the message is stored both in-memory,
 *                                      and on disk, and therefore preserved
 *                                      if the server dies or restarts.
 *
 * @param {[type]} options.arguments Additional arguments to
 *                                   specify when the exchange is declared.
 */

function Exchange(options) {
  options = options || {};
  // set default options
  this.name = options.name || '';
  this.type = options.type || defaultOptions.type;
  this.connection = options.connection;
  this.channel = options.channel;
  this.durable = _.isBoolean(options.durable) ? options.durable : defaultOptions.durable;
  this.autoDelete = options.autoDelete || defaultOptions.autoDelete;
  this.deliveryMode = options.deliveryMode || defaultOptions.deliveryMode;
  this.arguments = options.arguments || defaultOptions.arguments;
}

Exchange.prototype.use = function(channel) {
  var newExchange = new Exchange(this);
  newExchange.channel = channel;
  return newExchange;
};


Exchange.prototype.setChannel = function (channel) {
  this.channel = channel;
};

/**
 * Declare the exchange.
 *
 * Creates the exchange on the broker.
 *
 * @param  {Channel_Model} channel [description]
 * @param  {Object}  options
 * @param  {Boolean} options.nowait If set the server will not respond,
 *                                  and a response will not be waited for.
 *                                  Default is :const:`False`.
 * @param  {Boolean} options.passive [description]
 * @return {[type]}                 [description]
 */
Exchange.prototype.declare = function (options) {
  options = options || {};
  var self = this;
  var passive = _.isBoolean(options.passive) ? options.passive : false;
  var durable = this.durable;
  var autoDelete = this.autoDelete;
  var nowait = _.isBoolean(options.nowait) ? options.nowait : false;

  return this.channel.getChannel()
    .then(function (channel) {
      return channel.assertExchange(self.name, self.type, {
        passive: passive,
        durable: durable,
        autoDelete: autoDelete,
        arguments: self.arguments,
        nowait: nowait,
      });
    });
};

/**
 * Check whether the exchange is existed on the broker
 *
 * @param  {[type]} exchange exchange name
 *                           @default `this.name`
 * @return {Promise.resolve} if exchange exist
 * @return {Promise.reject} if exchange not exist
 */
Exchange.prototype.checkExchange = function (exchange) {
  if (!exchange) {
    exchange = this.name;
  }
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.checkExchange(exchange);
    });
};

/**
 * Binds the exchange to another exchange.
 *
 * @return {[type]} [description]
 */
Exchange.prototype.bindTo = function (exchange) {
  // body...
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
Exchange.prototype.Message = function (body, options) {
  options = options || {};
  var properties = options.properties || {};
  var headers = options.headers || {};
  var deliveryMode = _.has(options, 'deliveryMode') ? options.deliveryMode : this.deliveryMode;
  return new Message({
    body: body,
    headers: headers,
    deliveryMode: deliveryMode
  });
};

/**
 * Publish message.
 *
 * - channel.publish(exchange, routingKey, content, options)
 *
 * @param  {Message} message `Message` instance to publish.
 * @param  {Object} options
 * @param  {String} optiongs.routingKey Routing key.
 *
 * @return {[type]}         [description]
 */
Exchange.prototype.publish = function (message, options) {
  options = options || {};
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.publish(
        self.name, options.routingKey,
        message.encode(), message.getPublishOptions());
    });
};

/**
 * [binding description]
 *
 * @param  {[type]} options [description]
 * @param  {[type]} options.routingKey [description]
 *                                     @default ''
 * @param  {[type]} options.arguments [description]
 * @param  {[type]} options.unbindArguments [description]
 * @return {[type]}         [description]
 */
Exchange.prototype.binding = function (options) {
  // body...
};

/**
 * Delete the exchange declaration on server
 *
 * @param  {[type]} ifUnused Delete only if the exchange has no bindings.
 *                            Default is :const:`False`.
 * @param  {[type]} nowait    If set the server will not respond, and a
 *                            response will not be waited for. Default is :const:`False`.
 * @return {[type]}           [description]
 */
Exchange.prototype.delete = function (ifUnused, nowait) {
  var self = this;
  if (!this.channel){
    return Promise.reject(new Error('no channel to use'));
  }
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.deleteExchange(self.name, {
        ifUnused: ifUnused,
        nowait: nowait
      });
    });
};

module.exports = Exchange;
