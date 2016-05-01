// Copyright 2014 Orchestrate, Inc.
/**
 * @fileoverview Test Key-Value methods.
 */


// Module Dependencies.
var assert = require('assert');
var db = require('./creds')();
var users = require('./testdata')('key-value.test');
var util = require('util');
var misc = require('./misc');
var Q = require('kew');

suite('Key-Value', function () {
  suiteSetup(function() {
    return users.reset();
  });

  suiteTeardown(function() {
    return db.deleteCollection(users.collection);
  });

  test('Put/Get roundtrip', function () {
    return db.put(users.collection, users.steve.email, users.steve)
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(users.collection, users.steve.email);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(users.steve, res.body);
        return Q.resolve(res);
      });
  });

  test('Put/Get roundtrip, with whitelist field filtering', function () {
    return db.put(users.collection, users.steve.email, users.steve)
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(users.collection, users.steve.email, null, { 'with_fields' : 'value.name' });
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('{"name":"Steve Kaliski"}', JSON.stringify(res.body));
        return Q.resolve(res);
      });
  });

  test('Put/Get roundtrip, with blacklist field filtering', function () {
    return db.put(users.collection, users.steve.email, users.steve)
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(users.collection, users.steve.email, null, { 'without_fields' : [ 'value.email', 'value.location', 'value.type', 'value.gender' ] });
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('{"name":"Steve Kaliski"}', JSON.stringify(res.body));
        return Q.resolve(res);
      });
  });

  test('Get by ref', function() {
    return db.get(users.collection, users.steve.email, '0eb6642ca3efde45')
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(users.steve, res.body);
        return Q.resolve(res);
      });
  });

  test('List refs for a key', function() {
    return db.put(users.collection, users.steve.email, users.steve_v1)
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.list_refs(users.collection, users.steve.email);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(4, res.body.count);
        assert.equal("e85762917a99acce", res.body.results[0].path.ref);
        assert.equal("0eb6642ca3efde45", res.body.results[1].path.ref);
        assert.equal("0eb6642ca3efde45", res.body.results[2].path.ref);
        assert.equal("0eb6642ca3efde45", res.body.results[3].path.ref);
        return Q.resolve(res);
    });
  });

  test('Get list of values from a collection', function() {
    return db.list(users.collection, {limit:1})
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(1, res.body.count);
        assert.deepEqual(users.david, res.body.results[0].value);
        misc.assertUrlsEqual(res.body.next, '/v0/'+users.collection+'?limit=1&afterKey=byrd@bowery.io');
        return db.list(users.collection, {limit:1, afterKey:users.david.email});
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(1, res.body.count);
        assert.deepEqual(users.steve_v1, res.body.results[0].value);
        assert.equal(undefined, res.body.next);
        return db.list(users.collection, {limit:1, beforeKey:users.steve.email});
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(1, res.body.count);
        assert.deepEqual(users.david, res.body.results[0].value);
        // There is no next in this situation, since there are only two values
        // in the collection and the beforeKey predicate has restricted the list
        // to only the first item
        assert.equal(undefined, res.body.next);
        return Q.resolve(res);
    });
  });

  test('Partial updates: merge', function() {
    return db.merge(users.collection, users.steve.email, {type: "consultant"})
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(users.collection, users.steve.email);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(users.steve_v2, res.body);
        return Q.resolve(res);
      });
  });

  test('Partial updates: patch', function() {
    return db.newPatchBuilder(users.collection, users.steve.email)
      .add("type", "salaried")
      .copy("type", "paytype")
      .test("paytype", "salaried")
      .remove("paytype")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(users.collection, users.steve.email);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(users.steve_v3, res.body);
        return Q.resolve(res);
      });
  });

  test('If-None-Match put', function() {
    return db.put(users.collection, users.david.email, users.david, false)
      .fail(function (res) {
        assert.equal(412, res.statusCode);
        return db.put(users.collection, users.kelsey.email, users.kelsey, false);
      })
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return Q.resolve(res);
      });
  });

  test('If-Match put', function() {
    return db.put(users.collection, users.kelsey.email, users.kelsey, 'badetag')
      .fail(function (res) {
        assert.equal(400, res.statusCode);
        return db.put(users.collection, users.kelsey.email, users.kelsey_v1, 'c333c79ab9169d1f');
      })
    .then(function (res) {
      assert.equal(201, res.statusCode);
      return Q.resolve(res);
    });
  });

  test('If-Match patch', function() {
    return db.get(users.collection, users.steve.email)
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(users.steve_v3, res.body);
        return db.newPatchBuilder(users.collection, users.steve.email)
          .add("type", "consultant")
          .apply("00242d00737faf60");
      })
      .then(function() { return Q.reject("Expected patch to fail"); })
      .fail(function (res) {
        assert.equal(412, res.statusCode);
        return Q.resolve(res);
      });
  });

  test('Merge as upsert', function() {
    var key = users.steve.email + '_2';

    return db.merge(users.collection, key, {type: "consultant"}, {upsert:true})
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(users.collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual({type: "consultant"}, res.body);
        return Q.resolve(res);
      });
  });

});
