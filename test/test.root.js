var chai = require('chai');
global.expect = chai.expect;
chai.should();
chai.use(require('chai-as-promised'));
global.sinon = require('sinon');
// var heapdump = require('heapdump')
//
// after(function (done) {
//   this.timeout(20000);
//   setTimeout(function () {
//     heapdump.writeSnapshot(function () {
//       console.log('dump complete');
//       done();
//     });
//   }, 10000);
// });
