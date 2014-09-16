/**
 * Channel
 */
'use strict';

// var ChannelModel = require('amqplib').ChannelModel;
var debug = require('debug')('broker:channel');
var Promise = require('bluebird');

var Channel = function (channel, connection) {
  this.channel = channel;
  this.connection = connection;
  if (this.channel) {
    this.registerChannelEventListeners(channel);
  }
  this.initializeRetryVars();
};

Channel.prototype.initializeRetryVars = function () {
  this.retryTimer = null;
  this.retryTotaltime = 0;
  this.retryDelay = 0;
  this.retryBackoff = 1.7;
  this.attempts = 1;
};

Channel.prototype.getChannel = Promise.method(function () {
  if (!this.channel) {
    return this.createChannel();
  }
  return this.channel;
});

Channel.prototype.createChannel = function () {
  var self = this;
  debug('createChannel', 'delay', this.retryDelay);
  return Promise.delay(this.retryDelay)
    .then(function () {
      return self.connection._connection.createChannel();
    })
    .then(function (newChannel) {
      self.channel = newChannel;
      self.registerChannelEventListeners(newChannel);
      self.initializeRetryVars();
      return newChannel;
    });
};

Channel.prototype.registerChannelEventListeners = function (channel) {
  channel.once('error', this.onChannelError.bind(this));
  channel.once('close', this.onChannelClose.bind(this));
  channel.once('blocked', this.onChannelBlocked.bind(this));
  channel.once('unblocked', this.onChannelUnblocked.bind(this));
};

Channel.prototype.onChannelError = function (err) {
  debug('onChannelError', err);
};

Channel.prototype.onChannelClose = function (event) {
  debug('onChannelClose', event);
  this.channel = null;
};

Channel.prototype.onChannelBlocked = function (event) {
  debug('onChannelBlocked', event);
};

Channel.prototype.onChannelUnblocked = function (event) {
  debug('onChannelUnblocked', event);
};

module.exports = Channel;
