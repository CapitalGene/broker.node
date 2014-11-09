'use strict';
/**
 * Test Exchange
 *
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var Connection = require('./../lib/connection.js');
var Exchange = require('./../lib/exchange.js');
var debug = require('debug')('broker:test:exchange');

describe('Exchange', function () {
  this.timeout(10 * 1000);
  describe('#checkExchange(exchage)', function () {
    before(function () {
      this.connection = new Connection(this.testOptions);
      return this.connection.connect();
    });
    it('reject when not exist', function (done) {
      var self = this;
      var exchange = new Exchange();
      exchange.channel = this.connection.channel();
      exchange.checkExchange('somerandome')
        .should.be.rejected
        .then(function () {
          return exchange.channel;
        })
        .then(function (channel) {
          // can we still connect?
          return channel.checkExchange('myApp');
        })
        .should.be.rejected
        .then(function () {
          return self.connection.channel().getChannel();
        })
        .then(function (channel) {
          return channel.checkExchange('myApp');
        })
        .should.be.rejected
        .should.notify(done);
    });

  });
  describe('#declare()', function () {
    before(function () {
      var self = this;
      this.connection = new Connection(this.testOptions);
      this.exchange = new Exchange({
        name: 'broker.test',
        type: 'topic',
        durable: false,
        autoDelete: true,
        channel: this.connection.channel()
      });
      return this.connection.connect()
        .then(function () {
          return self.exchange.declare();
        })
        .then(function (result) {
          debug('declare', result);
          return result;
        });
    });
    after(function () {
      return this.exchange.delete();
    });
    it('declare the exchange', function (done) {
      this.exchange.checkExchange('broker.test')
        .then(function (result) {
          debug('checkExchange', result);
        })
        .should.notify(done);
    });
  });
  describe('#publish(message, options)', function () {
    before(function () {
      var self = this;
      this.connection = new Connection(this.testOptions);
      this.exchange = new Exchange({
        name: 'broker.test',
        type: 'topic',
        durable: false,
        autoDelete: true,
        channel: this.connection.channel()
      });
      return this.connection.connect()
        .then(function () {
          return self.exchange.declare();
        })
        .then(function (result) {
          debug('declare', result);
          return result;
        });
    });
    after(function () {
      return this.exchange.delete();
    });
    it('should able to publish message', function (done) {
      var message = this.exchange.Message({
        lol: 'lol'
      });
      this.exchange.publish(message, {
        routingKey: 'somewhere'
      })
        .should.eventually.be.true
        .then(function (result) {
          debug('publish', result);
        })
        .should.notify(done);
    });
  });
});
