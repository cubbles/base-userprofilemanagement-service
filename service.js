/* eslint-env node */
'user strict'
var restify = require('restify')
var assert = require('assert')
var PasswordChanger = require('./lib/passwordChanger')
var opts = {
  serviceName: 'UserProfileManagementService',
  servicePort: 3000,
  authDataStoreAdminCredentials: process.env.BASE_AUTH_DATASTORE_ADMINCREDENTIALS.split(':')
}

/*
 Throttle load per client to complicate cracking passwords by trail-and-error.
 "If a client has consumed all of their available rate/burst, an HTTP response code of 429 Too Many Requests is returned."
 > http://restify.com/#bundled-plugins > throttle
 > http://stackoverflow.com/questions/18282943/throttle-per-url-in-node-js-restify

 xff: identify the client based on the header 'x-forwarded-for' - set by the base.gateway
 */
var throttleConfig = process.env.BASE_RESTIFY_THROTTLE_CONFIG ? JSON.parse(process.env.BASE_RESTIFY_THROTTLE_CONFIG) : {
  burst: 7,
  rate: 5,
  xff: true
}

/*
 Start Server.
 */
var server = restify.createServer({
  name: opts.serviceName
})
server.listen(opts.servicePort)
console.log('%s - ' + opts.serviceName + ' started on port ' + opts.servicePort, (new Date()).toISOString())

/*
 * Anonymous handlers
 * ==================
 */
server.use(restify.throttle(throttleConfig))
server.use(restify.bodyParser())
server.use(function (req, res, next) {
  console.log('%s - ' + 'Received request "%s" from ip "%s"', (new Date()).toISOString(), req.getPath(), req.header('x-forwarded-for'))
  //
  if (!req.is('application/json')) {
    res.json(400, { message: 'Require Content-Type to be "application/json"' })
  }
  next()
})

// heath check
server.get('/',
  function (req, res, next) {
    res.json(200, { service: opts.serviceName, status: 'ok' })
    next()
  }
)

/*
 * Authentication and related handlers
 * ====================================
 */

server.use(restify.authorizationParser())
server.use(require('./lib/userDetector'))

server.get('/users/:login',
  function (req, res, next) {
    try {
      assert(req.cubxUserDoc, 'UserDoc expected to be available.')
    } catch (err) {
      res.json(500, { message: err.message })
      return
    }
    res.json(200, {
      userId: req.cubxUserDoc.name,
      logins: req.cubxUserDoc.logins,
      displayName: req.cubxUserDoc.displayName,
      email: req.cubxUserDoc.email
    })
    next()
  }
)

server.put('/users/:login/password',
  function (req, res, next) {
    // assertations
    try {
      assert(req.body.newPassword, 'New password expected.')
    } catch (err) {
      res.json(400, { message: err.message })
      return
    }
    try {
      assert(req.cubxUserDoc, 'UserDoc expected to be available.')
      assert(req.cubxUserPassword, 'UserPassword expected to be available.')
    } catch (err) {
      res.json(500, { message: err.message })
      return
    }

    // set new password
    var passwordChanger = new PasswordChanger()
    passwordChanger.changePassword(req.cubxUserDoc, req.cubxUserPassword, req.body.newPassword)
      .done(
        function () {
          res.json(200, { message: 'Password successfully changed.' })
          next()
        },
        function (err) {
          console.log(err)
          res.json(500, { message: err })
          next()
        })
  }
)
