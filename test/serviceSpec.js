/*global require,describe,it*/
'use strict'
var assert = require('assert')
var request = require('superagent')
var urljoin = require('url-join')
var testdata = require('./_testdata.js')
var opts = {
  serviceUrl: 'http://boot2docker.me:3002'
}

describe('userProfileManagementService', function () {
  it('content-type: should respond with 400 - Bad Request', function (done) {
    request.get(urljoin(opts.serviceUrl, '/'))
      .set('Accept', 'application/json')
      .set('x-forwarded-for', '0815')
      .end(function (err, res) {
        if (!err) {
          done('Error expected.')
        }
        assert.equal(res.statusCode, 400, 'Expected statusCode == 404')
        assert.ok(res.body.message.indexOf('application/json') > 0, 'Expected message to contain a content-type related note')
        done()
      })
  })

  it('throttling: should respond with ok for all requests', function (done) {
    var ips = []
    for (var i = 0; i < 20; i++) { ips.push(i) }
    ips.forEach(function (ip, index, array) {
      request.get(urljoin(opts.serviceUrl, '/'))
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
  it('throttling: should respond with 409 within the test', function (done) {
    var alreadyGot409 = false
    var ips = []
    for (var i = 0; i < 20; i++) { ips.push('0815') }
    ips.forEach(function (ip, index, array) {
      request.get(urljoin(opts.serviceUrl, '/'))
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

  it('user3 details: should respond with 200 - OK', function (done) {
    request.get(urljoin(opts.serviceUrl, '/users/user3'))
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('x-forwarded-for', '0815.123')
      .auth(testdata.users.user3.logins.local.login, testdata.users.user3.password)
      .end(function (err, res) {
        if (err) {
          console.log(res.body)
          done(err)
        }
        assert.equal(res.statusCode, 200, 'Expected statusCode == 200')
        console.log(res.body)
        done()
      })
  })
})
