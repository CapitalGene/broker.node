'use strict';
var chai = require('chai');
global.expect = chai.expect;
chai.should();
chai.use(require('chai-as-promised'));
global.sinon = require('sinon');

before(function () {
  this.testOptions = {
    uri: 'amqp://cg_test:cg_test@rmq.cloudapp.net:25673/cg_test'
  };
});
