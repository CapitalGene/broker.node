'use strict';
/**
 * Producer
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var _ = require('lodash');
var debug = require('debug')('broker:Router');


/**
 * Message Routing
 *
 * @param {[type]} options [description]
 * @param {Object} options.headers [description]
 * @param {String} options.routingKey [description]
 * @param {Exchange} options.exchange Override the exchange.
 *                                    Note that this exchange must have
 *                                    been declared
 * @param {Producer} options.producer required
 */
var Router = function (options) {
  this.options = options || {};
  this.producer = options.producer;
  if (!this.producer) {
    throw new Error('options.producer is required');
  }
};


/**
 * Return another route inherite from `Router` and override options
 *
 * @param  {[type]} options [description]
 * @return {Router}         [description]
 */
Router.prototype.route = function (options) {
  debug('route', options);
  var newOptions = _.defaults(options, this.options);
  return new Router(newOptions);
};

/**
 * Create another instance of `Router` that inherites configurations, but
 * append subRoute to `routingKey`
 *
 * @example
 * routingKey: `log.http` with subRoute: `auth` -> `log.http.auth`
 * routingKey: `` with subRoute: `log` -> `log`
 *
 * @param  {String} subRoute [description]
 * @return {[type]}          [description]
 */
Router.prototype.append = function(subRoute) {
  debug('append', subRoute);
  var newOptions = {
    routingKey: this.options.routingKey
  };
  if (!newOptions.routingKey) {
    newOptions.routingKey = subRoute;
  } else {
    newOptions.routingKey = newOptions.routingKey + '.' + subRoute;
  }
  return this.route(newOptions);
};


/**
 * Publish the message to `options.route`
 *
 * @param  {Message, Object} message [description]
 * @return {[type]}         [description]
 */
Router.prototype.publish = function (message) {
  debug('publish', message);
  return this.producer.publish(message, {
    headers: this.options.headers,
    routingKey: this.options.routingKey,
    exchange: this.options.exchange
  });
};


module.exports = Router;
