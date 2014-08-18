/**
 * brokerjs.connection
 */
var Promise = require('bluebird');
var amqp = require('./../../amqp.node/channel_api.js');
var debug = require('debug')('broker:connection');
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

  this._initParams(options);
  this._transport = amqp;
  this._connection = null;
  this._defaultChannel = null;
  this._closed = true;
}

/**
 * Combine options with default options and store it in `_options`
 *
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Connection.prototype._initParams = function (options) {
  this._options = options;
  this.host = options.host;
  this.username = options.username;
  this.password = options.password;
  this.vhost = options.vhost;
  this.port = options.port;
  this.connectTimeout = options.connectTimeout;
  this.heartbeat = options.heartbeat;
  this.uri = this._buildUri();
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
  return this.getConnection().then(function () {
    return self;
  });
};

Connection.prototype._establishConnection = function () {
  debug('establishing connection...');
  var self = this;
  // basically create a `amqp.ChannelModel`
  return this._transport
    .connect(this.uri)
    .then(function (conn) {
      // connected
      self._connection = conn;
      // close when exist
      // process.once('SIGINT', function () {
      //   self.close();
      // });
      debug('._establishConnection set _connection to conn');
      return conn; // resolve conn
    });
};

/**
 * Create and return a new channel.
 *
 * use amqp.Channel.createChannel()
 *
 * @return {Promise} resolve(amqp.Channel)
 */
Connection.prototype.channel = function () {
  debug('create channel');
  return this._connection.createChannel();
};

/**
 * Really close connection, even if part of a connection pool.
 *
 * @return {[type]} [description]
 */
Connection.prototype._close = function () {
  this._closed = true;
  if (this._connection) {
    this._connection.close();
  }
  this._defaultChannel = null;
  this._connection = null;
};

/**
 * Really close connection, even if part of a connection pool.
 *
 * @return {[type]} [description]
 */
Connection.prototype.close = function () {
  this._close();
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
    return self._defaultChannel();
  });
};

Connection.prototype.getTransport = function () {
  return this._transport;
};

// export
module.exports = Connection;
