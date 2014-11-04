/**
 * test connection.js
 *
 * @author Chen Liang [code@chen.technology]
 */
'use strict';
var Connection = require('./../lib/connection.js');
var Producer = require('./../lib/producer');
var Consumer = require('./../lib/consumer');

describe('Connection', function () {
  this.timeout(10 * 1000);
  describe('#constructor(options)', function () {
    before(function () {
      this.connection = new Connection(this.testOptions);
    });
    after(function () {
      this.connection = null;
    });
    it('sets `host`', function () {
      expect(this.connection.host)
        .to.equal(this.testOptions.host);
    });
    it('sets `port`', function () {
      expect(this.connection.port)
        .to.equal(this.testOptions.port);
    });
    it('sets `username`', function () {
      expect(this.connection.username)
        .to.equal(this.testOptions.username);
    });
    it('sets `password`', function () {
      expect(this.connection.password)
        .to.equal(this.testOptions.password);
    });
    it('sets `vhost`', function () {
      expect(this.connection.vhost)
        .to.equal(this.testOptions.vhost);
    });
    it('sets `uri`', function () {
      expect(this.connection.uri).to.exist;
    });
    it('sets `_options`', function () {
      expect(this.connection._options)
        .to.equal(this.testOptions);
    });
    it('sets privates vars to default values', function () {
      expect(this.connection._connection).to.be.null;
      expect(this.connection._defaultChannel).to.be.null;
      expect(this.connection._closed).to.be.null;
    });
  });
  describe('#getConnection()', function () {
    beforeEach(function () {
      this.connection = new Connection(this.testOptions);
    });
    afterEach(function (done) {
      var self = this;
      this.connection.close(function () {
        self.connection = null;
      });
      done();
    });
    it('resolve(connection) if not connected', function (done) {
      expect(this.connection._closed).to.be.null;
      this.connection.isConnected().should.be.false;
      this.connection.getConnection()
        .should.be.fulfilled
        .should.notify(done);
    });
    it('resolve amqp.Connection if connected', function (done) {
      var self = this;
      this.connection.connect()
        .should.be.fulfilled
        .then(function (connection) {
          connection.should.equal(self.connection._connection);
          return self.connection.getConnection()
            .should.be.fulfilled
            .should.eventually.equal(self.connection._connection);
        })
        .should.notify(done);
    });
  });
  describe('#connect()', function () {
    beforeEach(function () {
      this.connection = new Connection(this.testOptions);
    });
    afterEach(function () {
      this.connection.close();
      this.connection = null;
    });
    it('resolves this', function (done) {
      var self = this;
      this.connection.connect()
        .should.be.fulfilled
        .then(function (connection) {
          connection.should.equal(self.connection._connection);
          expect(self.connection._connection).to.exist;
          expect(self.connection.isConnected()).to.be.true;
        })
        .should.notify(done);
    });
  });
  describe('#close()', function () {
    beforeEach(function () {
      this.connection = new Connection(this.testOptions);
      return this.connection.connect();
    });
    afterEach(function () {
      if (this.connection._connection) {
        return this.connection._connection.close();
      }
    });
    it('closes and set _connection to null', function (done) {
      var self = this;
      expect(this.connection._connection).to.exist;
      this.connection._closed.should.be.false;
      this.connection.close()
        .should.be.fulfilled
        .then(function () {
          expect(self.connection._connection).to.not.exist;
          self.connection._closed.should.be.true;
        })
        .should.be.fulfilled
        .should.notify(done);
    });
  });
  describe('#channel()', function () {
    beforeEach(function () {
      this.connection = new Connection(this.testOptions);
      return this.connection.connect();
    });
    afterEach(function () {
      if (this.connection._connection) {
        return this.connection._connection.close();
      }
    });
    it('resolve new channel attached to connection', function (done) {
      this.connection.channel()
        .getChannel()
        .should.be.fulfilled
        .then(function (ch) {
          ch.should.have.property('connection');
          //ch.connection.should.equal(self.connection._connection);
        })
        .should.notify(done);
    });
  });
  describe.skip('#getDefaultChannel()', function () {
    beforeEach(function () {
      this.connection = new Connection(this.testOptions);
      return this.connection.connect();
    });
    afterEach(function () {
      if (this.connection._connection) {
        return this.connection._connection.close();
      }
    });
    it('resolve new channel and set to _defaultChannel', function(done) {
      var self = this;
      expect(this.connection._defaultChannel).to.not.exist;
      this.connection.getDefaultChannel()
      .should.be.fulfilled
      .then(function(createdChannel) {
        expect(self.connection._defaultChannel).to.exist;
      })
      .should.notify(done);
    });
  });
  describe('#Producer(options)', function() {
    before(function() {
      this.connection = new Connection(this.testOptions);
    });
    it('will return an instanceof Producer', function(done) {
      var producer = this.connection.Producer();
      producer.should.be.an.instanceof(Producer);
      expect(producer.channel).to.exist;
      done();
    });
  });
  describe('#Consumer(options)', function() {
    before(function() {
      this.connection = new Connection(this.testOptions);
    });
    it('will return an instanceof Consumer', function(done) {
      var consumer = this.connection.Consumer();
      consumer.should.be.an.instanceof(Consumer);
      expect(consumer.channel).to.exist;
      done();
    });
  });
});
