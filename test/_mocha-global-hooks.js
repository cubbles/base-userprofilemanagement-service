/**
 * Created by hrbu on 24.11.2015.
 * This file implements the global mocha root-level hooks 'before' and 'after'.
 * @see https://mochajs.org/#hooks >> Root-Level Hooks
 *
 * The test suite expects to have a boot2docker-instance up and running.
 */

/* globals before, after */
'use strict'
var opts = {
  couchUrl: 'http://admin:admin@boot2docker.me:5984',
  finallyRemoveTestData: false
}
var request = require('superagent')
var supercouch = require('supercouch')
var couch = supercouch(opts.couchUrl)
var testdata = require('./_testdata.js')

before(function (done) {
  console.log('\nbefore ...')
  require('chai').should()

  function addDocument (db, doc, next) {
    doc.created = Date.now()
    couch
      .db(db)
      .insert(doc)
      .end(function (err, res) {
        if (err) {
          console.log('Document update for "%s failed [%s]', doc._id, err.message)
        }
        console.log('%s "%s" available.', doc.docType ? doc.docType : 'user', doc._id)
        next()
      })
  }

  // add testuser and -groups
  addDocument('_users', testdata.users.user1, function () {
    done()
  })
}) // end "before"

after(function (done) {
  console.log('\nafter ...')

  function removeDocument (db, docId, next) {
    couch
      .db(db)
      .get(docId)
      .end(function (err, res) {
        if (err) {
          console.log(err)
          return done(err)
        }
        couch
          .db(db)
          .remove(docId, res._rev)
          .end(function (err, res) {
            if (err) {
              console.log('Remove document "%s" failed!', docId)
              return done(err)
            } else {
              console.log('Removed document "%s"', docId)
              next()
            }
          })
      })
  }

  function runCompaction (db, next) {
    // run a compaction to really remove the users documents
    request.post(opts.couchUrl + '/' + db + '/_compact')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .end(function (err, res) {
        if (err) {
          console.log('Compaction failed.', err)
          return done(err)
        }
        console.log('Compaction triggered.')
        next()
      })
  }

  // remove testuser and test-database

  if (opts.finallyRemoveTestData) {
    removeDocument('_users', testdata.users.admin1._id, function () {
      removeDocument('_users', testdata.users.user1._id, function () {
        runCompaction('_users', function () {
          done()
        })
      })
    })
  } else {
    done()
  }
})

