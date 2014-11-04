'use strict';
/**
 * Test Queue
 *
 * @author Chen Liang [code@chen.technology]
 */
var Connection = require('./../lib/connection.js');
var Queue = require('./../lib/queue.js');
var Exchange = require('./../lib/exchange.js');
var debug = require('debug')('broker:test:queue');
var Promise = require('bluebird');
var uuid = require('node-uuid');

describe('Queue', function () {
  this.timeout(10 * 1000);
  before(function () {
    this.connection = new Connection(this.testOptions);
    return this.connection.connect();
  });
  describe('#checkQueue()', function () {
    it('resolve null if not exist', function (done) {
      var queue = new Queue({
        name: 'broker.test.queue',
        durable: false,
        exclusive: true,
        autoDelete: true,
        channel: this.connection.channel()
      });
      queue.checkQueue('broker.test.queue')
        .then(function (result) {
          debug('checkQueue', result);
        })
        .should.be.rejected
        .should.notify(done);
    });
    it('resolve if exist', function (done) {
      var queue = new Queue({
        name: 'broker.test.queue',
        durable: false,
        exclusive: true,
        autoDelete: true,
        channel: this.connection.channel()
      });
      queue.queueDeclare()
        .then(function () {
          return queue.checkQueue('broker.test.queue');
        })
        .then(function (result) {
          debug('checkQueue', result);
        })
        .should.notify(done);
    });
  });
  describe('#bindTo(options)', function () {
    describe('when exchange not exist', function () {
      it('rejects 404', function (done) {
        var queue = new Queue({
          name: 'broker.test.queue',
          routingKey: 'broker.test.queue',
          durable: false,
          exclusive: true,
          autoDelete: true,
          channel: this.connection.channel()
        });
        var exchange = new Exchange({
          name: 'broker.test',
          type: 'topic',
          durable: false,
          autoDelete: true
        });
        queue.queueDeclare()
          .then(function () {
            return queue.bindTo({
              exchange: exchange,
              routingKey: 'broker.test.#'
            });
          })
          .should.be.rejectedWith(/404/)
          .should.notify(done);
      });
    });
    describe('when exchange exist', function () {
      it('resolve', function (done) {
        var exchange = new Exchange({
          name: 'broker.test',
          type: 'topic',
          durable: false,
          autoDelete: true,
          channel: this.connection.channel()
        });
        var queue = new Queue({
          name: 'broker.test.queue',
          routingKey: 'broker.test.queue',
          durable: false,
          exclusive: true,
          autoDelete: true,
          channel: this.connection.channel()
        });
        exchange.declare()
          .then(function () {
            return queue.queueDeclare();
          })
          .then(function () {
            return queue.bindTo({
              exchange: exchange,
              routingKey: 'broker.test.#'
            });
          })
          .then(function (result) {
            debug('bindTo', result);
          })
          .should.notify(done);
      });
    });
  });
  describe('#publish(message)', function () {
    it('dont need exchange', function (done) {
      var queue = new Queue({
        name: 'broker.test.queue',
        routingKey: 'broker.test.queue',
        durable: false,
        exclusive: true,
        autoDelete: true
      }).use(this.connection.channel());
      queue.queueDeclare()
        .then(function () {
          return queue.checkQueue('broker.test.queue');
        })
        .then(function (result) {
          result.should.have.property('messageCount', 0);
        })
        .then(function () {
          return queue.Message({
            lol: 'lol'
          });
        })
        .then(function (message) {
          return queue.publish(message);
        })
        .then(function (result) {
          debug('publish', result);
          return queue.checkQueue('broker.test.queue');
        })
        .then(function (result) {
          result.should.have.property('messageCount', 1);
        })
        .should.notify(done);
    });
  });
  describe('#get()', function () {
    it('resolve(one message)', function (done) {
      var queue = new Queue({
        name: 'broker.test.queueGet',
        routingKey: 'broker.test.#',
        durable: false,
        exclusive: true,
        autoDelete: true,
        channel: this.connection.channel()
      });
      queue.queueDeclare()
        .then(function () {
          return queue.checkQueue();
        })
        .then(function (result) {
          result.should.have.property('messageCount', 0);
        })
        .then(function () {
          return queue.Message({
            lol: 'lol'
          });
        })
        .then(function (message) {
          return queue.publish(message);
        })
        .then(function (result) {
          debug('publish', result);
          return queue.checkQueue();
        })
        .then(function (result) {
          result.should.have.property('messageCount', 1);
          return queue.get();
        })
        .then(function (result) {
          // debug('get', result);
          result.should.have.property('body');
          return queue.checkQueue();
        })
        .then(function (result) {
          result.should.have.property('messageCount', 0);
        })
        .should.notify(done);
    });
  });
  describe('#declare()', function () {
    it('will declare exchange, queue and bind', function (done) {
      var exchange = new Exchange({
        name: 'broker.test',
        type: 'topic',
        durable: false,
        autoDelete: true
      });
      var queue = new Queue({
        name: 'broker.test.queue',
        routingKey: 'broker.test.queue',
        exchange: exchange,
        bindings: [{
          exchange: exchange,
          routingKey: 'broker.test.queueDeclare'
        }, {
          exchange: exchange,
          routingKey: 'broker.test.#'
        }],
        durable: false,
        exclusive: true,
        autoDelete: true,
        channel: this.connection.channel()
      });
      queue.declare()
        .should.notify(done);
    });
  });
  describe('#consume()', function () {
    var exch1, exch2, queue1, queue2;
    var queue1Received, queue2Received;
    var queue1Handler, queue2Handler;
    var queue1ConsumerTag, queue2ConsumerTag;
    beforeEach(function () {
      this.connection = new Connection(this.testOptions);
      exch1 = new Exchange({
        name: 'broker.test.producer1',
        type: 'topic',
        durable: false,
        autoDelete: true
      }).use(this.connection.channel());
      exch2 = new Exchange({
        name: 'broker.test.producer2',
        type: 'topic',
        durable: false,
        autoDelete: true,
      }).use(this.connection.channel());
      queue1 = new Queue({
        name: 'broker.test.queue1',
        routingKey: 'broker.test.queue1',
        exchange: exch1,
        bindings: [{
          exchange: exch2,
          routingKey: 'broker.test.queue1'
        }],
      }).use(this.connection.channel());
      // queue2 only bind exchange 2
      // but will receive all message `broker.test.#`
      queue2 = new Queue({
        name: 'broker.test.queue2',
        routingKey: 'broker.test.#',
        exchange: exch2,
      }).use(this.connection.channel());
      queue1ConsumerTag = uuid.v4();
      queue2ConsumerTag = uuid.v4();
      queue1Received = [];
      queue2Received = [];
      queue1Handler = function (message) {
        // debug('handler', message);
        queue1Received.push(message);
      };
      queue2Handler = function (message) {
        // debug('handler', message);
        queue2Received.push(message);
      };
      return this.connection.connect()
        .then(function () {
          return Promise.all([
            exch1.declare(),
            exch2.declare(),
            queue1.declare(),
            queue2.declare()
          ]);
        });
    });
    afterEach(function () {
      var self = this;
      return Promise.join(
          queue1.cancel(queue1ConsumerTag),
          queue2.cancel(queue2ConsumerTag),
          queue1.delete(),
          queue2.delete(),
          exch1.delete(),
          exch2.delete()
        )
        .then(function () {
          return self.connection.close();
        });
    });
    it('one queue two exchange', function (done) {
      var self = this;
      // set up consumer
      queue1.consume({
        consumerTag: queue1ConsumerTag,
        noAck: true,
        callback: queue1Handler.bind(self)
      })
        .then(function (result) {
          debug('queue.consume', result);
          // exch1 publish
          var msg = exch1.Message({
            type: 'lol'
          });
          return exch1.publish(msg, {
            routingKey: 'broker.test.queue1'
          });
        })
        .delay(500)
        .then(function (result) {
          debug('exchange.publish');
          queue1Received.should
            .have.lengthOf(1);
        })
        .then(function () {
          // exch2 pub
          var msg = exch2.Message({
            type: 'lol'
          });
          return exch2.publish(msg, {
            routingKey: 'broker.test.queue1'
          });
        })
        .delay(500)
        .then(function (result) {
          debug('exchange.publish');
          queue1Received.should
            .have.lengthOf(2);
        })
        .should.notify(done);
    });
    it('two queues two exchange', function (done) {
      var self = this;
      // set up consumer
      queue1.consume({
        consumerTag: queue1ConsumerTag,
        noAck: true,
        callback: queue1Handler.bind(self)
      })
        .then(function () {
          return queue2.consume({
            consumerTag: queue2ConsumerTag,
            noAck: true,
            callback: queue2Handler.bind(self)
          });
        })
        .then(function () {
          // exch1 pub
          var msg = exch1.Message({
            type: 'lol'
          });
          return exch1.publish(msg, {
            routingKey: 'broker.test.queue1'
          });
        })
        .delay(500)
        .then(function () {
          // only queue1 will get the message
          queue1Received.should
            .have.lengthOf(1);
          queue2Received.should
            .have.lengthOf(0);
        })
        .then(function () {
          // exch2 pub to queue1
          var msg = exch2.Message({
            type: 'lol'
          });
          return exch2.publish(msg, {
            routingKey: 'broker.test.queue1'
          });
        })
        .delay(500)
        .then(function () {
          // both queue1 and queue2 will get the message
          queue1Received.should
            .have.lengthOf(2);
          queue2Received.should
            .have.lengthOf(1);
        })
        .then(function () {
          // exch2 pub to queue2
          var msg = exch2.Message({
            type: 'lol'
          });
          return exch2.publish(msg, {
            routingKey: 'broker.test.queue2'
          });
        })
        .delay(500)
        .then(function () {
          // only queue2 will get the message
          queue1Received.should
            .have.lengthOf(2);
          queue2Received.should
            .have.lengthOf(2);
        })
        .should.notify(done);
    });
  });
});
