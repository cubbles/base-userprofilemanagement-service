/* eslint-env node */
var Promise = require('promise')
var restify = require('restify')

var opts = {
  serviceName: 'UserProfileManagementService',
  servicePort: 3000,
  authDataStoreAdminCredentials: process.env.BASE_AUTH_DATASTORE_ADMINCREDENTIALS.split(':'),
  baseDataStoreUrl: process.env.BASE_AUTH_DATASTORE_URL
}

module.exports = PasswordChanger

function PasswordChanger () {
  this._client = restify.createJsonClient({
    url: opts.baseDataStoreUrl,
    headers: {
      'content-type': 'application/json'
    }
  })
}

PasswordChanger.prototype.changePassword = function (localLogin, password, newPassword) {
  var client = this._client
  return new Promise(
    function (resolve, reject) {
      detectUser(client, localLogin)
        .then(function (userDocId) {
          console.log('Found user', userDocId)
          setPassword(client, userDocId, password, newPassword)
        })
        .then(resolve, reject)
    })
}

/**
 * @param client - The restify client to use.
 * @param login - the users login for the passed 'authSource'
 * @return {Promise}
 */
function detectUser (client, login) {
  client.basicAuth(opts.authDataStoreAdminCredentials[ 0 ], opts.authDataStoreAdminCredentials[ 1 ])
  return new Promise(
    function (resolve, reject) {
      client.get('/_users/_design/couchapp-authentication-utils@_users/_view/viewUsersByLogin?startkey=["local","' + login + '"]&endkey=["local","' + login + '"]&stale=update_after', function (err, req, res, obj) {
        /*
         * Example result:
         * {"total_rows":3,"offset":0,"rows":[
         *   {"id":"org.couchdb.user:123admin1","key":["local","admin1@cubbles.test", true],"value":null}
         * ]}
         */
        if (err) {
          reject(err)
          return
        }
        if (obj.rows.length < 1) {
          // console.log('Second try done.')
          reject({
            id: 'USER_NOT_FOUND',
            desc: 'No user found with a local login "' + login + '".'
          })
          return
        }
        if (obj.rows.length > 1) {
          var rejectObj = {
            id: 'MULTIPLE_USERS_FOUND',
            desc: 'Found ' + obj.rows.length + ' users a local login "' + login + '"! Please contact the Administrator!".'
          }
          reject(rejectObj)
          return
        }
        resolve(obj.rows[ 0 ].id)
      })
    })
}

/**
 * @param client - The restify client to use.
 * @param userDocId
 * @param password
 * @param newPassword
 * @return {*|exports|module.exports}
 */
function setPassword (client, userDocId, password, newPassword) {
  return new Promise(
    function (resolve, reject) {
      // request for the users document to verify it's current credentials
      var username = userDocId.split(':')[ 1 ]
      client.basicAuth(username, password)
      client.get('/_users/' + userDocId, function (err, req, res, obj) {
        if (err) {
          reject(err)
          return
        }
        // change the password and save the doc
        var userDoc = obj
        userDoc.password = newPassword
        client.put('/_users/' + userDocId, userDoc, function (err, req, res, obj) {
          if (err) {
            reject(err)
          }
          resolve(res.statusCode)
        })
      })
    }
  )
}

