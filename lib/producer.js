'use strict';
/**
 * Producer
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var Promise = require('bluebird');
var Exchange = require('./exchange');
var Connection = require('./connection');
var Message = require('./message');
var _ = require('lodash');
var debug = require('debug')('broker:Producer');
var Router = require('./router');


/**
 * Message Producer.
 *
 * @param {Object} options [description]
 * @param {Channel} options.channel Connection or channel.
 * @param {Exchange} options.exchange Optional default exchange.
 * @param {String} options.routingKey Optional default routing key.
 * @param {Boolean} options.autoDeclare Automatically declare the default
 *                                      exchange at instantiation.
 *                                      @default true
 *
 */
var Producer = function (options) {
  options = options || {};
  this.channel = options.channel;
  this.exchange = options.exchange;
  this.routingKey = options.routingKey;
  this.autoDeclare = _.isBoolean(options.autoDeclare) ? options.autoDeclare : true;
  if (!this.exchange) {
    this.exchange = new Exchange();
  }
  // debug('.constructor.autoDeclare', this.autoDeclare);
  if (this.autoDeclare) {
    this.exchange = this.exchange.use(this.channel);
  }
  // debug('.constructor.exchange', this.exchange);
};

/**
 * Declare `exchange` for this producer
 * @return {[type]} [description]
 */
Producer.prototype.declare = Promise.method(function () {
  if (!_.isEmpty(this.exchange.name)) {
    return this.exchange.declare();
  }
});

/**
 * Publish message to the specified exchange.
 * Use `Channel_Model.publish(exchange, routingKey, content, options)`
 *
 * @param  {Message} message  Message body.
 * @param  {String} routingKey Message routing key.
 *
 * @param  {Object} options [description]
 * @param  {Object} options.headers Mapping of arbitrary headers to pass
 *                                 along with the message body.
 * @param  {String} options.routingKey Override default routingKey
 * @param  {Exchange} options.exchange Override the exchange.
 *                                    Note that this exchange must have
 *                                    been declared.
 *
 * @return {[type]}         [description]
 */
Producer.prototype.publish = function (message, options) {
  options = options || {};
  var exchange = options.exchange || this.exchange.name;
  var routingKey = options.routingKey || this.routingKey;
  if (exchange instanceof Exchange) {
    exchange = exchange.name;
  }

  if (!(message instanceof Message)) {
    message = new Message({
      body: message
    });
  }

  if (_.isNull(message.deliveryMode) || _.isUndefined(message.deliveryMode)) {
    message.deliveryMode = this.deliveryMode;
  }

  return this.channel.getChannel()
    .then(function (channel) {
      return channel.publish(
        exchange, routingKey,
        message.encode(), message.getPublishOptions());
    });
};

/**
 * Use `Channel_Model.publish(exchange, routingKey, content, options)
 *
 * @param  {[type]} exchange   [description]
 * @param  {[type]} routingKey [description]
 * @param  {[type]} content    [description]
 * @param  {[type]} options    [description]
 * @return {[type]}            [description]
 */
Producer.prototype._publish = function (exchange, routingKey, content, options) {
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.publish(exchange, routingKey, content, options);
    });
};

/**
 * Return a `Router` instance with `this` as the producer
 *
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Producer.prototype.route = function (options) {
  debug('route', options);
  options = options || {};
  options.producer = this;
  return new Router(options);
};

module.exports = Producer;
