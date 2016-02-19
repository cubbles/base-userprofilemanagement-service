/*global require,describe,it*/
'use strict'
var assert = require('assert')
var urljoin = require('url-join')
var request = require('superagent')
var restify = require('restify')
var testdata = require('./_testdata.js')
var opts = {
  coreDataStoreUrl: 'http://boot2docker.me:5984',
  profileManagementServiceGatewayUrl: 'http://boot2docker.me/_api/manageprofile'
}

describe('passwordChanger', function () {
  it('should successfully change password for user1', function (done) {
    var requestBody = {
      user: testdata.users.user1.logins.local.login,
      password: testdata.users.user1.password,
      newPassword: 'changed1'
    }
    request.put(urljoin(opts.profileManagementServiceGatewayUrl, '/users/' + testdata.users.user1.logins.local.login + '/password'))
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(JSON.stringify(requestBody))
      .end(function (err, res) {
        if (err) {
          console.log('statusCode: ', res.statusCode)
          console.log('resMessage: ', res.body.message)
          console.log(err)
          done(err)
          return
        }

        assert.equal(res.statusCode, 200, 'StatusCode expected to be 200')
        assert.equal(res.body.message, 'Password successfully changed.', 'Expected another message.')

        // check password by requesting the users document directly form couchdb (only the user itself is allowed to access it)
        function requestUserDocFromCouchDb () {
          var client = restify.createJsonClient({
            url: opts.coreDataStoreUrl, headers: { 'content-type': 'application/json' }
          })
          client.basicAuth(testdata.users.user1.name, testdata.users.user1.password)
          client.get('/_users/' + testdata.users.user1._id, function (err, req, res, obj) {
            if (err && err.statusCode === 401) {
              // this should happen, as we used the OLD password for requesting the users document
              done()
              return
            }
            // console.log(err)
            done(new Error('Expected the request to be failed, as the password should have already been changed.'))
          })
        }
        setTimeout(requestUserDocFromCouchDb, 100)
      })
  })

  it('password change should fail for unknown user', function (done) {
    var requestBody = {
      user: testdata.users.user1.logins.local.login,
      password: testdata.users.user1.password,
      newPassword: 'changed1'
    }
    request.put(urljoin(opts.profileManagementServiceGatewayUrl, '/users/unknownLocalLogin/password'))
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(JSON.stringify(requestBody))
      .end(function (err, res) {
        if (err && res.body.message.id === 'USER_NOT_FOUND') {
          // we expect an error here
          done()
          return
        }

        console.log('statusCode: ', res.statusCode)
        console.log('resMessage: ', res.body.message)
        done('Requests expected to fail.')
      })
  })
})
