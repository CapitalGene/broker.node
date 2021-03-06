'use strict';
/**
 * Channel
 *
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var debug = require('debug')('broker:channel');
var Promise = require('bluebird');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

/**
 * Channel
 *
 * @param {[type]} channel    [description]
 * @param {Connection} connection [description]
 */
var Channel = function(channel, connection) {
  this.channel = channel;
  this.connection = connection;
  if (this.channel) {
    this.registerChannelEventListeners(channel);
  }
  this.initializeRetryVars();
};
inherits(Channel, EventEmitter);

/**
 * set initial values for retry variables
 * @return {[type]} [description]
 */
Channel.prototype.initializeRetryVars = function() {
  this.retryTimer = null;
  this.retryTotaltime = 0;
  this.retryDelay = 0;
  this.retryBackoff = 1.7;
  this.attempts = 1;
};

/**
 * Create an `amqp.node` channel if not exist
 *
 * @return {Promise<amqp.channel>} [description]
 */
Channel.prototype.getChannel = Promise.method(function() {
  if (!this.channel) {
    return this.createChannel();
  }
  return this.channel;
});

/**
 * Create an `amqp.node` channel
 *
 * @return {[type]} [description]
 */
Channel.prototype.createChannel = function() {
  var self = this;
  debug('createChannel', 'delay', this.retryDelay);
  return Promise
    .delay(this.retryDelay) // handle delay
    .then(function() {
      return self.connection.getConnection()
        .then(function(_conn) {
          return _conn.createChannel();
        });
    })
    .then(function(newChannel) {
      self.channel = newChannel;
      self.registerChannelEventListeners(newChannel);
      self.initializeRetryVars();
      return newChannel;
    });
};

Channel.prototype.close = function() {
  return this.channel.close();
};

/**
 * Register `channel` events
 * @param  {[type]} channel [description]
 * @return {[type]}         [description]
 */
Channel.prototype.registerChannelEventListeners = function(channel) {
  channel.once('error', this.onChannelError.bind(this));
  channel.once('close', this.onChannelClose.bind(this));
  channel.once('blocked', this.onChannelBlocked.bind(this));
  channel.once('unblocked', this.onChannelUnblocked.bind(this));
};


/**
 * called when channel errors
 *
 * @param  {[type]} err [description]
 * @return {[type]}     [description]
 */
Channel.prototype.onChannelError = function(err) {
  debug('onChannelError', err);
// this.emit('error', err);
};

/**
 * called when channel closed
 *
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
Channel.prototype.onChannelClose = function(event) {
  debug('onChannelClose', event);
  this.channel = null;
  this.emit('close', event);
};

/**
 * called when channel blocked
 *
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
Channel.prototype.onChannelBlocked = function(event) {
  debug('onChannelBlocked', event);
  this.emit('blocked', event);
};

/**
 * called when channel unblocked
 *
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
Channel.prototype.onChannelUnblocked = function(event) {
  debug('onChannelUnblocked', event);
  this.emit('unblocked', event);
};

module.exports = Channel;
