'use strict';
/**
 * Message Entity
 *
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var Promise = require('bluebird');
var debug = require('debug')('broker:Message');

/**
 * Base class for received messages.
 *
 * @param {Object} options [description]
 * @param {Object} options.body [description]
 * @param {Channel} options.channel [description]
 * @param {Object} options.headers [description]
 * @param {Object} options.properties [description]
 * @param {String} options.deliveryTag [description]
 * @param {String} options.deliveryInfo [description]
 * @param {String} options.correlationId Useful to correlate RPC responses with
 *                                       requests.
 * @param {String} options.replyTo Commonly used to name a callback queue.
 * @param {String} options.contentType Used to describe the mime-type of the
 *                                     encoding. For example for the often used
 *                                     JSON encoding it is a good practice to
 *                                     set this property to: `application/json`
 *                                     @default `application/json`
 * @param {String} options.contentEncoding [description]
 * @param {Number} options.expiration [description]
 */
var Message = function (options, rawMessage) {
  this.body = options.body || {};
  this.channel = options.channel;
  this.headers = options.headers;
  this.properties = options.properties;
  this.deliveryTag = options.deliveryTag;
  this.deliveryInfo = options.deliveryInfo;
  this.deliveryModel = options.deliveryModel;
  this.correlationId = options.correlationId;
  this.replyTo = options.replyTo;
  this.expiration = options.expiration;
  this.contentType = options.contentType || 'application/json';
  this.contentEncoding = options.contentEncoding;
  this.rawMessage = rawMessage || {
    fields: {
      deliveryTag: this.deliveryTag
    }
  };
  this._state = 'RECEIVED';
};

/**
 * Create an new message instance from raw `ampq.node` message
 *
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
Message.fromRawMessage = function (message) {
  var properties = message.properties;
  var headers = message.headers;
  if (!message.fields) {
    debug('fromRawMessage', 'no fields');
  }
  var deliveryTag = message.fields.deliveryTag;
  var deliveryModel = message.fields.deliveryModel;
  var contentType = message.fields.contentType;
  var contentEncoding = message.fields.contentEncoding;
  var correlationId = message.properties.correlationId;
  var replyTo = message.properties.replyTo;
  return new Message({
    body: message.content.toString(),
    properties: properties,
    headers: headers,
    deliveryTag: deliveryTag,
    deliveryModel: deliveryModel,
    correlationId: correlationId,
    contentType: contentType,
    contentEncoding: contentEncoding,
    replyTo: replyTo
  }, message);
};

/**
 * Encode the `body` to JSON string
 *
 * @return {Buffer} [description]
 */
Message.prototype.encode = function () {
  return new Buffer(JSON.stringify(this.body));
};

/**
 * return an object that contains publish options for this message
 *
 * @return {Object} [description]
 */
Message.prototype.getPublishOptions = function () {
  return {
    headers: this.headers,
    correlationId: this.correlationId,
    deliveryModel: this.deliveryModel,
    expiration: this.expiration,
    replyTo: this.replyTo,
    contentType: this.contentType,
    contentEncoding: this.contentEncoding
  };
};

Message.prototype.ACK_STATES = ['ACK', 'REJECTED', 'REQUEUED'];

/**
 * Acknowledge this message as being processed.,
 * This will remove the message from the queue.

 * @throws {MessageStateError} If the message has already been
 * @throws {MessageStateError} If acknowledged/requeued/rejected.
 *
 * @return {[type]} [description]
 */
Message.prototype.ack = function () {
  this._state = 'ACK';
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.ack(self.rawMessage);
    });

};

/**
 * Reject this message.
 *
 * The message will be discarded by the server.
 *
 * @throws {MessageStateError} If the message has already been
 *                             acknowledged/requeued/rejected.
 * @param  {[type]} options [description]
 * @param  {Boolean} options.requeue [description]
 * @return {[type]}         [description]
 */
Message.prototype.reject = function (channel, options) {
  options = options || {};
  var requeue = options.requeue;
  this._state = 'REJECTED';
  var self = this;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.reject(self.rawMessage, requeue);
    });
};

/**
 * Reject this message and put it back on the queue.
 *
 * You must not use this method as a means of selecting messages to process.
 *
 * @throws {MessageStateError} If the message has already been
 *                             acknowledged/requeued/rejected.
 * @return {[type]} [description]
 */
Message.prototype.requeue = function () {
  if (this.isAcknowledged()) {
    return Promise.reject(new Error('Message already acknowledged with state'));
  }
  var self = this;
  this._state = 'REQUEUED';
  var requeue = true;
  return this.channel.getChannel()
    .then(function (channel) {
      return channel.reject(self.rawMessage, requeue);
    });
};

/**
 * Set to true if the message has been acknowledged.
 *
 * @return {Boolean} [description]
 */
Message.prototype.isAcknowledged = function () {
  return this.ACK_STATES.indexOf(this._state) !== -1;
};

/**
 * The decoded message body.
 *
 * @return {[type]} [description]
 */
Message.prototype.getPayload = Promise.method(function () {
  return JSON.parse(this.body);
});

module.exports = Message;
