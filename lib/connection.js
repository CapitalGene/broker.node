'use strict';
/**
 * Connection
 *
 * Broker connection and pools.
 *
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var Promise = require('bluebird');
var amqp = require('amqplib');
var debug = require('debug')('broker:connection');
var poolModule = require('generic-pool');
var uuid = require('node-uuid');
var _ = require('lodash');

var Producer = require('./producer');
var Consumer = require('./consumer');
var Channel = require('./channel');
var delay = global.setImmediate || process.nextTick;

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

var CLIENT_PROPERTIES = {
  'product': 'broker.node',
  'version': require('../package.json').version,
  'platform': 'Node.JS ' + process.version,
  'information': 'https://github.com/CapitalGene/broker.node',
  'capabilities': {
    'publisher_confirms': true,
    'exchange_exchange_bindings': true,
    'basic.nack': true,
    'consumer_cancel_notify': true,
    'connection.blocked': true,
    'authentication_failure_close': true
  }
};

/**
 * A connection to the broker.
 *
 * @param {[type]} options [description]
 * @param {[type]} options.host [description]
 * @param {[type]} options.user [description]
 * @param {[type]} options.password [description]
 * @param {[type]} options.vhost [description]
 * @param {[type]} options.port Default port if not provided in the URL.
 * @param {[type]} options.connectionTimeout Timeout in seconds for connecting
 *                                           to the server. May not be
 *                                           supported by the specified transport.
 * @param {[type]} options.transportOptions A dict of additional connection
 *                                          arguments to pass to alternate
 *                                          brokerjs channel implementations.
 * @param {[type]} options.heartbeat Heartbeat interval in int/float seconds.
 *
 */
function Connection(options) {
  // EventEmitter.call(this);
  this._initParams(options);
  this._transport = amqp;
  this._connection = null;
  this._defaultChannel = null;
  this._closed = null;
}
// inherits(Connection, EventEmitter);

/**
 * Combine options with default options and store it in `_options`
 *
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Connection.prototype._initParams = function (options) {
  options = options || {};
  this._options = options;
  this.uri = options.uri;
  this.host = options.host;
  this.username = options.username;
  this.password = options.password;
  this.vhost = options.vhost;
  this.port = options.port;
  if (!_.isString(options.uri)) {
    this.uri = this._buildUri();
  }
  this.connectTimeout = options.connectTimeout;
  this.heartbeat = options.heartbeat;
};

/**
 * Build Uri based on options
 *
 * @return {[type]}         [description]
 */
Connection.prototype._buildUri = function () {
  var uri = 'amqp://' + this.username + ':' + this.password +
    '@' + this.host + ':' + this.port + '/' + this.vhost;
  debug('_buildUri:' + uri);
  return uri;
};

/**
 * Establish connection to server immediately.
 *
 * @return {Promise} this `Connection` object
 *                   `this`
 */
Connection.prototype.connect = function () {
  debug('connect');
  var self = this;
  this._closed = false; //?
  return this.getConnection();
};

Connection.prototype._establishConnection = function () {
  debug('establishing connection...');
  var self = this;
  // basically create a `amqp.ChannelModel`
  return this._transport
    .connect(this.uri, {
      clientProperties: CLIENT_PROPERTIES,
      keepAlive: true
    })
    .then(function (conn) {
      // connected
      self._connection = conn;
      self.registerEventListeners(conn);
      debug('._establishConnection set _connection to conn');
      return conn; // resolve conn
    })
    .then(function (connection) {
      // self.setupChannelPool(connection);
      return connection;
    });
};

Connection.prototype.getChannel = function () {
  // debug('getChannel');
  var self = this;
  return new Promise(function (resolve, reject) {
    self.channelPool.acquire(function (err, channel) {
      if (err) {
        return reject(err);
      }
      // debug('getChannel', 'acquire');
      return resolve(channel);
    });
  });
};

/**
 * Create and return a new channel.
 *
 * use this.getChannel()
 *
 * @return {Promise} resolve(amqp.Channel)
 */
Connection.prototype.channel = function () {
  debug('create channel');
  // var self = this;
  return new Channel(null, this);
};

Connection.prototype.checkQueue = function (queueName) {
  return this.useChannel(function (channel) {
    return channel.checkQueue(queueName);
  });
};

/**
 * Create new :class:`Producer` instance using this
 * connection.
 */
Connection.prototype.Producer = function (options) {
  options = options || {};
  if (!options.channel) {
    options.channel = this.channel();
  }
  var producer = new Producer(options);
  return producer;
};

/**
 * Create new :class:`Consumer` instance using this
 * connection.
 */
Connection.prototype.Consumer = function (options) {
  options = options || {};
  if (!options.channel) {
    options.channel = this.channel();
  }
  var consumer = new Consumer(options);
  return consumer;
};

/**
 * Really close connection, even if part of a connection pool.
 *
 * @return {[type]} [description]
 */
Connection.prototype._close = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
      self._closed = true;
      if (self._connection) {
        return resolve(self._connection.close());
      }
      return resolve();
    })
    .finally(function () {
      self._defaultChannel = null;
      self._connection = null;
    });
};

/**
 * Really close connection, even if part of a connection pool.
 *
 * @return {[type]} [description]
 */
Connection.prototype.close = function () {
  return this._close();
};

/**
 * Ensure we have a connection to the server.
 * If not retry establishing the connection with the settings specified.
 *
 *
 * @param  {[type]} options [description]
 * @param  {[type]} options.errback [description]
 * @param {[type]} options.maxRetries Maximum number of times to retry.
 *                                    If this limit is exceeded the connection
 *                                    error will be re-raised.
 *
 * @param {[type]} options.intervalStart The number of seconds we start
 *                                       sleeping for.
 * @param {[type]} options.intervalSteps How many seconds added to the interval
 *                                  for each retry
 *
 * @param {[type]} options.callback Optional callback that is called for
 *                                  every internal iteration (1 s)
 *
 * @return {Connection}         [description]
 */
Connection.prototype.ensureConnection = function (options) {
  // body...
};

/**
 * Revive connection after connection re-established.
 *
 * @param  {[type]} newChannel [description]
 * @return {[type]}            [description]
 */
Connection.prototype.revive = function (newChannel) {
  // body...
};

/**
 * [_defaultEnsureCallback description]
 *
 * @return {[type]} [description]
 */
Connection.prototype._defaultEnsureCallback = function (err, interval) {
  debug('Ensure: Operation error: ', err, '. Retry in ', interval, 's');
};

/**
 * Return true if the connection has been established.
 *
 * @return {Boolean} [description]
 */
Connection.prototype.isConnected = function () {
  return (!this._closed && this._connection !== null);
};

/**
 * The underlying connection object.
 *
 * @return {Promise} resolve(amqp.connection)
 * @return {undefined} if not connected
 */
Connection.prototype.getConnection = function () {
  debug('getConnection');
  if (!this._closed) {
    debug('getConnection _closed = true');
    if (!this.isConnected()) {
      debug('getConnection isConnected() = false');
      this._defaultChannel = null;
      this._closed = false;
      return this._establishConnection();
    }
    debug('getConnection isConnected() = true');
    return Promise.resolve(this._connection);
  }
  return Promise.resolve(null);
};

/**
 * Default channel, created upon access and closed when the connection
 * is closed.
 *
 * Can be used for automatic channel handling when you only need one
 * channel, and also it is the channel implicitly used if a connection
 * is passed instead of a channel, to functions that require a channel.
 *
 * @return {Promise} broker.Channel
 */
Connection.prototype.getDefaultChannel = function () {
  var self = this;
  // make sure we're still connected, and if not refresh.
  return this.getConnection().then(function () {
    if (self._defaultChannel === null) {
      self._defaultChannel = self.channel();
    }
    return self._defaultChannel;
  });
};

Connection.prototype.getTransport = function () {
  return this._transport;
};

Connection.prototype.registerEventListeners = function (connection) {
  connection.on('error', this.onError);
  connection.on('close', this.onClose);
  connection.on('blocked', this.onBlocked);
  connection.on('unblocked', this.onUnblocked);
};

Connection.prototype.onError = function (err) {
  console.log(err.stack);
  debug('onError', err);
  // this.emit('error', err);
};

Connection.prototype.onClose = function (event) {
  debug('onClose', event);
  // this.emit('close', event);
};

Connection.prototype.onBlocked = function (event) {
  debug('onBlocked', event);
  // this.emit('blocked', event);
};

Connection.prototype.onUnblocked = function (event) {
  debug('onUnblocked', event);
  // this.emit('unblocked', event);
};

// export
module.exports = Connection;
