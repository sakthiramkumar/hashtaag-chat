// Copyright 2014 Orchestrate, Inc.
/**
 * @fileoverview Test search methods
 */

// Module Dependencies.
var assert = require('assert');
var db = require('./creds')();
var users = require('./testdata')('search.test');
var Q = require('kew');
var util = require('util');
var misc = require('./misc');

suite('Search', function () {
  suiteSetup(function () {
    return users.reset().then(function() { return users.insertAll(); });
  });

  suiteTeardown(function() {
    return db.deleteCollection(users.collection);
  });

  // Basic search
  test('Basic search', function () {
    return db.newSearchBuilder()
      .collection(users.collection)
      .query('location: New*')
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(2, res.body.count);
        return Q.resolve(res);
      });
  });

  // Basic search with whitelist field filtering
  test('Basic search with whitelist field filtering', function () {
    return db.newSearchBuilder()
      .collection(users.collection)
      .withFields('value.name')
      .query('value.name:"Steve Kaliski"')
      .then(function (res) {
        assert.equal('{"name":"Steve Kaliski"}', JSON.stringify(res.body.results[0].value));
        return Q.resolve(res);
      });
  });

  // Basic search with blacklist field filtering
  test('Basic search with blacklist field filtering', function () {
    return db.newSearchBuilder()
      .collection(users.collection)
      .withoutFields('value.email', 'value.location', 'value.type', 'value.gender')
      .query('value.name:"Steve Kaliski"')
      .then(function (res) {
        assert.equal('{"name":"Steve Kaliski"}', JSON.stringify(res.body.results[0].value));
        return Q.resolve(res);
      });
  });

  // Cross-collection search (find all items in the 'users' collections, via query clause)
  test('Cross-collection search', function () {
    return db.newSearchBuilder()
      .limit(10)
      .query('@path.collection:`' + users.collection + '`')
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(3, res.body.count);
        return Q.resolve(res);
      });
  });

  // Search with offset
  test('Search with offset', function () {
    return db.newSearchBuilder()
      .collection(users.collection)
      .offset(2)
      .query('*')
      .then(function (res) {
        assert.equal(200, res.statusCode);
        // Order doesn't matter, but there should be only 1 out of the three in
        // the result
        assert.equal(1, res.body.count);
        return Q.resolve(res);
      });
  });

  // Search with offset and limit
  test('Search with offset & limit', function () {
    return db.newSearchBuilder()
      .collection(users.collection)
      .offset(1)
      .limit(1)
      .query('*')
      .then(function (res) {
        assert.equal(200, res.statusCode);
        // XXX: API inconsistency?
        //        assert.equal(2, res.body.total_count);
        assert.equal(1, res.body.count);
        misc.assertUrlsEqual(res.body.next, '/v0/'+users.collection+'?limit=1&query=*&offset=2');
        return Q.resolve(res);
      });
  });

  // Search and sort
  suite('Sorting', function() {
    test('Search and sort', function () {
      return db.newSearchBuilder()
        .collection(users.collection)
        .sort('name', 'desc')     // Reverse-alpha
        .query('New York')
        .then(function (res) {
          assert.equal(200, res.statusCode);
          assert.equal(2, res.body.results.length);
          assert.equal(users.steve.email, res.body.results[0].path.key);
          assert.equal(users.david.email, res.body.results[1].path.key);
          return Q.resolve(res);
        });
    });

    suite('Sort Generation', function() {
      var builder;

      setup(function(done) {
        builder = db.newSearchBuilder();
        done();
      });

      test('sortRandom', function(done) {
        builder.sortRandom();
        assert.equal('_random', builder._generateSort());
        done();
      });

      test('sortRandom with seedValue', function(done) {
        builder.sortRandom('seed');
        assert.equal('_random:seed', builder._generateSort());
        done();
      });

      test('sortBy', function(done) {
        builder.sortBy('value.foo');
        assert.equal('value.foo', builder._generateSort());
        done();
      });

      test('sortBy many fields', function(done) {
        builder.sortBy('value.foo', 'value.bar:asc');
        assert.equal('value.foo,value.bar:asc', builder._generateSort());
        done();
      });

      test('sortBy and sortRandom', function(done) {
        builder.sortBy('@path.key').sortRandom();
        assert.equal('@path.key,_random', builder._generateSort());
        done();
      });
    });
  });

  // TODO Geo-search

  // Aggregates
  test('Search aggregates', function () {
    return db.newSearchBuilder()
    .collection(users.collection)
    .aggregate('stats', 'value.name')
    .top_values('value.tags')
    .top_values('value.categories', 20, 10)
    .stats('value.username')
    .range('value.coolness', '*~1:1~2:2~*')
    .range('value.radness', function (builder) {
      return builder
      .before(1)
      .between(1, 2)
      .after(2);
    })
    .distance('value.location', '*~1:1~2:2~*')
    .distance('value.hometown', function (builder) {
      return builder
      .before(1)
      .between(1, 2)
      .after(2);
    })
    .time_series('path', 'day')
    .time_series('path', 'hour', '+0900')
    .query('value.location:NEAR:{latitude:12.3 longitude:56.7 radius:100km}')
    .then(function (res) {
      assert.equal(200, res.statusCode);
      return Q.resolve(res);
    });
  });

  // Search Events
  test('Search events', function () {
    return db.newSearchBuilder()
      .collection(users.collection)
      .kinds('event')
      .query('@path.type:activities AND steve')
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(1, res.body.total_count);
        assert.equal(users.steve.email, res.body.results[0].path.key);
        assert.equal('event', res.body.results[0].path.kind);
        assert.equal('activities', res.body.results[0].path.type);
        return Q.resolve(res);
      });
  });

});
