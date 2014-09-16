'use strict';
var chai = require('chai');
global.expect = chai.expect;
chai.should();
chai.use(require('chai-as-promised'));
global.sinon = require('sinon');

before(function () {
  this.testOptions = {
    host: 'rmq.cloudapp.net',
    port: 25673,
    username: 'cg_test',
    password: 'cg_test',
    vhost: 'cg_test',
  };
});
