/**
 * Producer
 */
'use strict';
var Promise = require('bluebird');
var Exchange = require('./exchange');
var Connection = require('./connection');
var Message = require('./message');
var _ = require('lodash');
var debug = require('debug')('broker:Producer');
/**
 * Message Producer.
 *
 * @param {Object} options [description]
 * @param {Channel} options.channel Connection or channel.
 * @param {Exchange} options.exchange Optional default exchange.
 * @param {String} options.routingKey Optional default routing key.
 * @param {Boolean} options.autoDeclare Automatically declare the default
 *                                      exchange at instantiation.
 *                                      Default is :const:`True`.
 *
 */
var Producer = function (options) {
  options = options || {};
  this.channel = options.channel;
  this.exchange = options.exchange;
  this.routingKey = options.routingKey;
  this.autoDeclare = options.autoDeclare;
  if (!this.exchange) {
    this.exchange = new Exchange();
  }
};

Producer.prototype.setChannel = function (channel) {
  this.channel = channel;
};

Producer.prototype.getChannel = Promise.method(function () {
  return this.channel;
});

Producer.prototype.declare = Promise.method(function () {
  if (!_.isEmpty(this.exchange.name)) {
    if (!this.exchange.channel) {
      this.exchange.setChannel(this.channel);
    }
    return this.exchange.declare();
  }
});

/**
 * Publish message to the specified exchange.
 * Use `Channel_Model.publish(exchange, routingKey, content, options)
 *
 * @param  {Message} message  Message body.
 * @param  {String} routingKey Message routing key.
 *
 * @param  {Object} options [description]
 * @param  {Object} options.headers Mapping of arbitrary headers to pass
 *                                 along with the message body.
 * @param  {Exchange} options.exchange Override the exchange.
 *                                    Note that this exchange must have
 *                                    been declared.
 *
 * @return {[type]}         [description]
 */
Producer.prototype.publish = function (message, routingKey, options) {
  options = options || {};
  var exchange = options.exchange || this.exchange;
  if (exchange instanceof Exchange) {
    exchange = exchange.name;
  }
  if (_.isNull(message.deliveryMode) || _.isUndefined(message.deliveryMode)){
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


module.exports = Producer;
