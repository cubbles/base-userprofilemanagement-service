/*global require,describe,it*/
'use strict'
var assert = require('assert')
var request = require('superagent')
var opts = {
  serviceUrl: 'http://boot2docker.me:3002'
}

describe('userProfileManagementService', function () {
  it('should respond with ok for all requests', function (done) {
    var ips = []
    for (var i = 0; i < 20; i++) { ips.push(i) }
    ips.forEach(function (ip, index, array) {
      request.get(opts.serviceUrl, '/')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .set('x-forwarded-for', ip)
        .end(function (err, res) {
          if (err) {
            done(err)
            return
          }
          // console.log('Request %s - state %s', ip, res.status)
          assert.equal(res.body.status, 'ok', 'Expected status == true')
        })
    })
    setTimeout(done, 1500)
  })

  /**
   *
   */
  it('should respond with 409 within the test', function (done) {
    var alreadyGot409 = false
    var ips = []
    for (var i = 0; i < 20; i++) { ips.push('0815') }
    ips.forEach(function (ip, index, array) {
      request.get(opts.serviceUrl, '/')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .set('x-forwarded-for', ip)
        .end(function (err, res) {
          if (err) {
            // console.log('Expected error on request %s - state %s', index, res.status)
            assert.equal(res.statusCode, 429, 'Expected state 429 (Too Many Requests.)')
            if (!alreadyGot409) {
              alreadyGot409 = true
              done()
            }
            return
          }
          assert.equal(res.body.status, 'ok', 'Expected status == true')
          if (index === (array.length - 1)) {
            done(new Error('Error response expected before the last request.'))
          }
        })
    })
  })
})
