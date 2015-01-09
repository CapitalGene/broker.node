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
var Producer = require('./../lib/producer.js');
var Router = require('./../lib/router.js');
var debug = require('debug')('broker:test:router');

describe('Router', function () {
  describe('constructer(options)', function () {
    it('throw if no `options.producer`', function () {
      expect(function () {
        var router = new Router();
      }).to.throw;
    });
    it('assigns options to this.options', function () {
      var options = {
        producer: {}
      };
      var router = new Router(options);
      router.options
        .should.equal(options);
    });
    it('assigns options.producer to this.producer', function () {
      var producer = {};
      var options = {
        producer: producer
      };
      var router = new Router(options);
      router.producer
        .should.equal(producer);
    });
  });
  describe('#route(options)', function () {
    it('override `routingKey`', function () {
      var producer = {};
      var options = {
        producer: producer,
        routingKey: 'log'
      };
      var router = new Router(options);
      var newRouter = router.route({
        routingKey: 'test'
      });
      newRouter.should.be.an.instanceOf(Router);
      newRouter.producer.should.equal(producer);
      newRouter.options.routingKey
        .should.equal('test');
    });
  });
  describe('#append(subRoute)', function () {
    describe('when router.options.routingKey not exist', function () {
      it('use subRoute as routingKey', function () {
        var producer = {};
        var options = {
          producer: producer
        };
        var router = new Router(options);
        var newRouter = router.append('test');
        newRouter.producer.should.equal(producer);
        newRouter.options.routingKey
          .should.equal('test');
      });
    });
    describe('when router.options.routingKey exist', function () {
      it('append `.subRoute`', function () {
        var producer = {};
        var options = {
          producer: producer,
          routingKey: 'log'
        };
        var router = new Router(options);
        var newRouter = router.append('test');
        newRouter.producer.should.equal(producer);
        newRouter.options.routingKey
          .should.equal('log.test');
      });
    });
  });
});
