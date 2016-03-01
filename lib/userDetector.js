/* eslint-env node */
var Promise = require('promise')
var restify = require('restify')
var assert = require('assert')

var opts = {
  authDataStoreAdminCredentials: process.env.BASE_AUTH_DATASTORE_ADMINCREDENTIALS.split(':'),
  baseDataStoreUrl: process.env.BASE_AUTH_DATASTORE_URL
}

module.exports = function (req, res, next) {
  if (!req.params.login) {
    next()
    return
  }

  // assume, this requests for user details and therefore needs authentication
  try {
    // extract login and password
    req.cubxUserLogin = req.params.login
    req.cubxUserPassword = req.body ? req.body.password : undefined
    if (req.authorization && req.authorization.basic) {
      req.cubxUserPassword = req.authorization.basic.password
    }
    assert(req.cubxUserPassword, 'Password expected.')
  } catch (err) {
    console.log(err)
    res.json(400, { message: err.message })
    return
  }

  // detect user
  var promise = (new UserDetector()).detectUser(req.cubxUserLogin, req.cubxUserPassword)
  promise.done(
    function (userDoc) {
      req.cubxUserDoc = userDoc
      next()
    },
    function (err) {
      if (err.id && err.id === 'USER_NOT_FOUND') {
        res.json(404, { message: err })
        return
      }
      if (err.id && err.id === 'USER_AUTHENTICATION_FAILED') {
        res.json(400, { message: err })
        return
      }
      res.json(400, { message: err })
    }
  )
}

function UserDetector () {
  this._client = restify.createJsonClient({
    url: opts.baseDataStoreUrl,
    headers: {
      'content-type': 'application/json'
    }
  })
}

/**
 * @param localLogin
 * @param localPassword
 * @return {*|exports|module.exports}
 */
UserDetector.prototype.detectUser = function (localLogin, localPassword) {
  var client = this._client
  return new Promise(
    function (resolve, reject) {
      client.basicAuth(opts.authDataStoreAdminCredentials[ 0 ], opts.authDataStoreAdminCredentials[ 1 ])
      client.get('/_users/_design/couchapp-authentication-utils@_users/_view/viewUsersByLogin?startkey=["local","' + localLogin + '"]&endkey=["local","' + localLogin + '"]', function (err, req, res, obj) {
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
        if (obj.rows.length === 1) {
          /*
           * Request for the users document to verify it's current credentials
           */
          client.basicAuth(obj.rows[ 0 ].id.split(':')[ 1 ], localPassword)
          client.get('/_users/' + obj.rows[ 0 ].id, function (err, req, res, obj) {
            if (err) {
              console.log('err: ', err)
              reject({
                id: 'USER_AUTHENTICATION_FAILED',
                desc: JSON.stringify(err)
              })
              return
            }
            resolve(obj)
            return
          })
        }
        if (obj.rows.length < 1) {
          reject({
            id: 'USER_NOT_FOUND',
            desc: 'No user found with a local login "' + localLogin + '".'
          })
          return
        }
        if (obj.rows.length > 1) {
          var rejectObj = {
            id: 'MULTIPLE_USERS_FOUND',
            desc: 'Found ' + obj.rows.length + ' users a local login "' + localLogin + '"! Please contact the Administrator!".'
          }
          reject(rejectObj)
          return
        }
      })
    })
}

