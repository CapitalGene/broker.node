'use strict';
/**
 * Test Producer
 *
 * @author Chen Liang [code@chen.technology]
 */

/*!
 * Module dependencies.
 */
var Promise = require('bluebird');
var Connection = require('./../lib/connection.js');
var Queue = require('./../lib/queue.js');
var Exchange = require('./../lib/exchange.js');
var Message = require('./../lib/message.js');
var Consumer = require('./../lib/consumer.js');
var Producer = require('./../lib/producer.js');
var Router = require('./../lib/router.js');
var debug = require('debug')('broker:test:producer');

describe('Producer', function () {
  beforeEach(function () {
    this.connection = new Connection(this.testOptions);
    this.producer = new Producer({
      routingKey: 'broker.test.producer',
      channel: this.connection.channel()
    });
    return this.connection.connect();
  });
  afterEach(function () {
    return this.connection.close();
  });
  describe('#publish(message, routingKey, options)', function () {
    it('is able to publish without exchange', function (done) {
      var message = new Message({
        body: {
          lol: 'lol'
        }
      });
      this.producer.publish(message, 'broker.test.1')
        .then(function (result) {
          debug('publish', result);
        })
        .should.notify(done);
    });
    it('publishes with exchange', function (done) {
      var self = this;
      var exchange = new Exchange({
        name: 'broker.test.producer',
        type: 'topic',
        durable: false,
        autoDelete: true
      });
      // exchange.setChannel(this.connection.channel());
      this.producer = new Producer({
        routingKey: 'broker.test.producer',
        exchange: exchange,
        channel: this.connection.channel()
      });
      var message = new Message({
        body: {
          lol: 'lol'
        },
        deliveryModel: true,
      });
      this.producer.declare()
        .then(function () {
          // return self.producer.publish(message, 'broker.test.#');
          var msgs = [];
          for (var i = 0; i < 100; i++) {
            msgs.push(self.producer.publish(message, {
              routingKey: 'broker.test.#'
            }));
          }
          return Promise.all(msgs);
        })
        .should.notify(done);
    });
    it('should support options.headers', function (done) {
      var self = this;
      var exchange = new Exchange({
        name: 'broker.test.producer',
        type: 'topic',
        durable: false,
        autoDelete: true
      });
      // exchange.setChannel(this.connection.channel());
      this.producer = new Producer({
        routingKey: 'broker.test.producer.options.headers',
        exchange: exchange,
        channel: this.connection.channel()
      });
      var receivedMessages = [];
      var messageHandler = function (message) {
        receivedMessages.push(message);
      }
      var consumer = new Consumer({
        noAck: true,
        channel: this.connection.channel(),
        messageHandler: messageHandler
      });
      var optionsHeadersQueue = new Queue({
        name: 'broker.test.optionsHeadersQueue',
        routingKey: 'broker.test.producer.options.headers',
        exchange: exchange,
      });
      this.producer.declare()
        .then(function () {
          consumer.addQueue(optionsHeadersQueue);
          return consumer.declare()
            .then(function () {
              return consumer.consume();
            })
            .delay(200);
        })
        .then(function () {
          return self.producer.publish('something', {
            routingKey: 'broker.test.producer.options.headers',
            headers: {
              taskTest: 'lol'
            }
          })
        })
        .delay(200)
        .then(function () {
          receivedMessages.should.have.lengthOf(1);
          var msg = receivedMessages[0];
          msg.should.have.property('headers')
            .that.has.property('taskTest', 'lol');
        })
        .should.notify(done);
    });
  });
  describe('#route(options)', function () {
    it('returns an instance of Router', function () {
      var route = this.producer.route({
        routingKey: 'broker.test.route'
      });
      route.should.be.an.instanceOf(Router);
      route.options.routingKey.should.equal('broker.test.route');
      route.producer.should.equal(this.producer);
    });
  });
});
