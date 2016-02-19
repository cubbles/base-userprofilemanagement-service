/* eslint-env node */
'user strict'
var restify = require('restify')
var PasswordChanger = require('./lib/passwordChanger')
var opts = {
  serviceName: 'UserProfileManagementService',
  servicePort: 3000,
  authDataStoreAdminCredentials: process.env.BASE_AUTH_DATASTORE_ADMINCREDENTIALS.split(':')
}
var server = restify.createServer({
  name: opts.serviceName
})
server.use(restify.bodyParser())
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
server.use(restify.throttle(throttleConfig))
server.listen(opts.servicePort)
console.log('%s - ' + opts.serviceName + ' started on port ' + opts.servicePort, (new Date()).toISOString())

/*
 * health check
 */
server.get('/', function (req, res, next) {
  res.json(200, { service: opts.serviceName, status: 'ok' })
  next()
})

server.put('/users/:login/password', function (req, res, next) {
  var passwordChanger = new PasswordChanger()

  function onSuccess () {
    res.json(200, { message: 'Password successfully changed.' })
    next()
  }
  function onRejected (err) {
    console.log(err)
    res.json(500, { message: err })
  }
  passwordChanger.changePassword(req.params.login, req.body.password, req.body.newPassword)
    .done(onSuccess, onRejected)
})

