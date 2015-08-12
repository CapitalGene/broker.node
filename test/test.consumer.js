'use strict';
/**
 * test Consumer
 *
 * @author Chen Liang [code@chen.technology]
 */

/*eslint "no-unused-expressions": 0 */

/*!
 * Module dependencies.
 */
var Promise = require('bluebird');
var Connection = require('./../lib/connection.js');
var Queue = require('./../lib/queue.js');
var Exchange = require('./../lib/exchange.js');
// var Message = require('./../lib/message.js');
var Producer = require('./../lib/producer.js');
var Consumer = require('./../lib/consumer');
var debug = require('debug')('broker:test:consumer');

describe('Consumer', function() {
  this.timeout(10 * 1000);
  var queue1, queue2;
  var exchange1, exchange2;
  var producer1, producer2;
  beforeEach(function() {
    this.connection = new Connection(this.testOptions);
    exchange1 = new Exchange({
      name: 'broker.test.producer1',
      type: 'topic',
      durable: false,
      autoDelete: true,
    });
    exchange2 = new Exchange({
      name: 'broker.test.producer2',
      type: 'topic',
      durable: false,
      autoDelete: true,
    });
    queue1 = new Queue({
      name: 'broker.test.queue1',
      routingKey: 'broker.test.queue1',
      exchange: exchange1,
      bindings: [{
        exchange: exchange2,
        routingKey: 'broker.test.queue1',
      }],
    });
    // queue2 only bind exchange 2
    // but will receive all message `broker.test.#`
    queue2 = new Queue({
      name: 'broker.test.queue2',
      routingKey: 'broker.test.#',
      exchange: exchange2,
    });
    producer1 = new Producer({
      exchange: exchange1,
      routingKey: 'broker.test.queue1',
      channel: this.connection.channel(),
    });
    producer2 = new Producer({
      exchange: exchange2,
      routingKey: 'broker.test.queue2',
      channel: this.connection.channel(),
    });
    return this.connection.connect()
      .then(function() {
        return producer1.declare();
      })
      .then(function() {
        return producer2.declare();
      });
  });
  afterEach(function() {
    var self = this;
    var channel = this.connection.channel();
    return Promise.join(
      queue1.use(channel).delete(),
      queue2.use(channel).delete(),
      exchange1.use(channel).delete(),
      exchange2.use(channel).delete()
    )
      .then(function() {
        return self.connection.close();
      });
  });
  describe('#addQueue(queue)', function() {
    it('add a copy of queue if `autoDeclare`', function(done) {
      var consumer = new Consumer({
        noAck: true,
        channel: this.connection.channel(),
      });
      consumer.addQueue(queue2)
        .then(function() {
          consumer.queues.should.have.lengthOf(1);
          consumer.queues[0].should.be.an.instanceOf(Queue);
          consumer.queues[0].should.not.equal(queue2);
        })
        .should.notify(done);
    });
    it('will not consume added `queue`', function(done) {
      var consumer = new Consumer({
        noAck: true,
        channel: this.connection.channel(),
      });
      consumer.addQueue(queue2)
        .then(function() {
          consumer.queues.should.have.lengthOf(1);
          consumer.queues[0].should.be.an.instanceOf(Queue);
          consumer.queues[0].should.not.equal(queue2);
          consumer.isConsumingFrom(consumer.queues[0])
            .should.be.false;
        })
        .should.notify(done);
    });
    it('working with `queue.bindings`', function(done) {
      var consumer = new Consumer({
        noAck: true,
        channel: this.connection.channel(),
      });
      consumer.addQueue(queue1)
        .then(function() {
          consumer.queues.should.have.lengthOf(1);
          consumer.queues[0].should.be.an.instanceOf(Queue);
          consumer.queues[0].should.not.equal(queue1);
        })
        .should.notify(done);
    });
  });
  describe('#consume()', function() {
    describe('when consume defined queue', function() {
      var consumer;
      var receivedMessages;
      beforeEach(function() {
        receivedMessages = [];
        var messageHandler = function(message) {
          receivedMessages.push(message);
          debug('messageHandler', receivedMessages.length);
        };
        consumer = new Consumer({
          noAck: true,
          channel: this.connection.channel(),
          queues: [queue2],
          messageHandler: messageHandler
        });
        return consumer.declare()
          .then(function() {
            return consumer.consume();
          });
      });
      it('receives messages published to queues', function(done) {
        receivedMessages.should.have.lengthOf(0);
        producer2.publish('m1')
          .delay(500)
          .then(function(result) {
            debug('publish', result);
            receivedMessages.should.have.lengthOf(1);
          })
          .should.notify(done);
      });
      it('receives messages from added queues', function(done) {
        consumer.addQueue(queue1)
          .then(function() {
            return consumer.consume();
          })
          .then(function() {
            return producer1.publish('m1').delay(500);
          })
          .then(function() {
            receivedMessages.should.have.lengthOf(1);
          })
          .should.notify(done);
      });
    });
    describe('when two consumers consume', function() {
      var consumer1, consumer2;
      var receivedMessages1, receivedMessages2;
      beforeEach(function() {
        receivedMessages1 = [];
        receivedMessages2 = [];
        var messageHandler1 = function(message) {
          receivedMessages1.push(message);
          debug('messageHandler1', receivedMessages1.length);
        };
        var messageHandler2 = function(message) {
          receivedMessages2.push(message);
          debug('messageHandler2', receivedMessages1.length);
        };
        consumer1 = new Consumer({
          noAck: true,
          channel: this.connection.channel(),
          queues: [queue2],
          messageHandler: messageHandler1,
        });
        consumer2 = new Consumer({
          noAck: true,
          channel: this.connection.channel(),
          queues: [queue2],
          messageHandler: messageHandler2
        });
        return Promise.all([consumer1.declare(), consumer2.declare()])
          .then(function() {
            return Promise.all([consumer1.consume(), consumer2.consume()]);
          });
      });
      it('both receive messages published to queues', function(done) {
        receivedMessages1.should.have.lengthOf(0);
        receivedMessages2.should.have.lengthOf(0);
        producer2.publish('m1')
          .delay(500)
          .then(function(result) {
            debug('publish', result);
            receivedMessages1.should.have.lengthOf(1);
            receivedMessages1.should.have.lengthOf(1);
          })
          .should.notify(done);
      });
      it('isolates from one the other', function(done) {
        consumer2.addQueue(queue1)
          .then(function() {
            return consumer2.consume();
          })
          .then(function() {
            return producer1.publish('m1').delay(500);
          })
          .then(function() {
            receivedMessages1.should.have.lengthOf(0);
            receivedMessages2.should.have.lengthOf(1);
          })
          .should.notify(done);
      });
    });
  });
  describe('#qos(options)', function() {
    var consumer;
    var receivedMessages;
    var ackMessageFunctions;
    beforeEach(function() {
      receivedMessages = [];
      ackMessageFunctions = [];
      var messageHandler = function(message) {
        receivedMessages.push(message);
        ackMessageFunctions.push(function() {
          return message.ack();
        });
        debug('messageHandler', receivedMessages.length);
      };
      consumer = new Consumer({
        noAck: false,
        channel: this.connection.channel(),
        queues: [queue2],
        messageHandler: messageHandler
      });
      return consumer.declare()
        .then(function() {
          return consumer.consume();
        });
    });
    describe('when options.prefetchCount=1,applyGlobal=true', function() {
      beforeEach(function(done) {
        consumer.qos({
          prefetchCount: 1,
          applyGlobal: true
        })
          .then(function(response) {
            debug('qos', 'response', response);
          })
          .should.notify(done);
      });
      it('receives one message only', function(done) {
        var publishingPromise = Promise.resolve();
        var publishAndSetPromise = function(i) {
          return function() {
            publishingPromise = producer2.publish('m' + i);
          };
        };
        for (var i = 0; i < 10; i++) {
          publishingPromise
            .then(publishAndSetPromise(i));
        }
        publishingPromise
          .delay(500)
          .then(function() {
            receivedMessages.should.have.lengthOf(1);
            return receivedMessages[0].getPayload();
          })
          .then(function(payload) {
            payload.should.equal('m0');
          })
          .then(function() {
            return ackMessageFunctions[0]();
          })
          .delay(200)
          .then(function() {
            receivedMessages.should.have.lengthOf(2);
            return receivedMessages[1].getPayload();
          })
          .then(function(payload) {
            payload.should.equal('m1');
          })
          .should.notify(done);
      });
    });
    describe('when options.prefetchCount=2,applyGlobal=true', function() {
      beforeEach(function(done) {
        consumer.qos({
          prefetchCount: 2,
          applyGlobal: true
        })
          .then(function(response) {
            debug('qos', 'response', response);
          })
          .should.notify(done);
      });
      it('receives one message only', function(done) {
        var publishingPromise = Promise.resolve();
        var publishAndSetPromise = function(i) {
          return function() {
            publishingPromise = producer2.publish('m' + i);
          };
        };
        for (var i = 0; i < 10; i++) {
          publishingPromise
            .then(publishAndSetPromise(i));
        }
        publishingPromise
          .delay(500)
          .then(function() {
            receivedMessages.should.have.lengthOf(2);
            return receivedMessages[0].getPayload();
          })
          .then(function(payload) {
            payload.should.equal('m0');
            return receivedMessages[1].getPayload();
          })
          .then(function(payload) {
            payload.should.equal('m1');
          })
          .then(function() {
            return ackMessageFunctions[0]();
          })
          .delay(200)
          .then(function() {
            receivedMessages.should.have.lengthOf(3);
            return receivedMessages[2].getPayload();
          })
          .then(function(payload) {
            payload.should.equal('m2');
          })
          .should.notify(done);
      });
    });
  });
});
