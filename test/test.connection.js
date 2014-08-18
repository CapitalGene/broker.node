/**
 * test connection.js
 */

var Connection = require('./../lib/connection.js');

describe('Connection', function () {
  var testOptions = {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT ? parseInt(process.env.PORT) : 15672,
    username: process.env.USERNAME || null,
    password: process.env.PASSWORD || null,
    vhost: process.env.VHOST || null,
  };
  describe('#constructor(options)', function () {
    before(function () {
      this.connection = new Connection(testOptions);
    });
    after(function () {
      this.connection = null;
    });
    it('sets `host`', function () {
      expect(this.connection.host)
        .to.equal(testOptions.host);
    });
    it('sets `port`', function () {
      expect(this.connection.port)
        .to.equal(testOptions.port);
    });
    it('sets `username`', function () {
      expect(this.connection.username)
        .to.equal(testOptions.username);
    });
    it('sets `password`', function () {
      expect(this.connection.password)
        .to.equal(testOptions.password);
    });
    it('sets `vhost`', function () {
      expect(this.connection.vhost)
        .to.equal(testOptions.vhost);
    });
    it('sets `uri`', function () {
      expect(this.connection.uri).to.exist;
    });
    it('sets `_options`', function () {
      expect(this.connection._options)
        .to.equal(testOptions);
    });
    it('sets privates vars to default values', function () {
      expect(this.connection._connection).to.be.null;
      expect(this.connection._defaultChannel).to.be.null;
      expect(this.connection._closed).to.be.true;
    });
  });
  describe('#getConnection()', function () {
    beforeEach(function () {
      this.connection = new Connection(testOptions);
    });
    afterEach(function (done) {
      var self = this;
      this.connection.close(function () {
        self.connection = null;
      });
      done();
    });
    it('resolve(null) if not connected', function (done) {
      this.connection._closed.should.be.true;
      this.connection.isConnected().should.be.false;
      this.connection.getConnection()
        .should.be.fulfilled
        .should.eventually.not.exist
        .should.notify(done);
    });
    it('resolve amqp.Connection if connected', function (done) {
      var self = this;
      this.connection.connect()
        .should.be.fulfilled
        .then(function (connectedConnection) {
          connectedConnection.should.equal(self.connection);
          return self.connection.getConnection()
            .should.be.fulfilled
            .should.eventually.equal(self.connection._connection);
        })
        .should.notify(done);
    });
  });
  describe('#connect()', function () {
    beforeEach(function () {
      this.connection = new Connection(testOptions);
    });
    afterEach(function () {
      this.connection.close();
      this.connection = null;
    });
    it('resolves this', function (done) {
      this.connection.connect()
        .should.be.fulfilled
        .should.eventually.equal(this.connection)
        .then(function (establishedConnection) {
          expect(establishedConnection._connection).to.exist;
          expect(establishedConnection.isConnected()).to.be.true;
        })
        .should.notify(done);
    });
  });
});
