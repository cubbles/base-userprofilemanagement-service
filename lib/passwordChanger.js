/* eslint-env node */
var Promise = require('promise')
var restify = require('restify')

var opts = {
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

PasswordChanger.prototype.changePassword = function (userDoc, password, newPassword) {
  var client = this._client
  return new Promise(
    function (resolve, reject) {
      setPassword(client, userDoc, password, newPassword)
        .then(resolve, reject)
    })
}

/**
 * @param client - The restify client to use.
 * @param userDoc
 * @param password
 * @param newPassword
 * @return {*|exports|module.exports}
 */
function setPassword (client, userDoc, password, newPassword) {
  return new Promise(
    function (resolve, reject) {
      // request for the users document to verify it's current credentials
      var userDocId = userDoc._id
      var username = userDoc.name
      client.basicAuth(username, password)
      userDoc.password = newPassword
      client.put('/_users/' + userDocId, userDoc, function (err, req, res, obj) {
        if (err) {
          reject(err)
        }
        resolve(res.statusCode)
      })
    }
  )
}

