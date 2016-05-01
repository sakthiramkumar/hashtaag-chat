// Copyright 2014 Orchestrate, Inc.
/**
 * @fileoverview Test graph methods
 */

// Module Dependencies.
var assert = require('assert');
var db = require('./creds')();
var users = require('./testdata')('graph.test');
var Q = require('kew');
var util = require('util');

var createRelation = function(collection, from, to, kind, data, ref) {
  var builder = db.newGraphBuilder().create();
  
  if (typeof data !== 'undefined') {
    builder.data(data);
  }
  if (typeof ref !== 'undefined') {
    builder.ref(ref);
  }

  return builder.from(collection, from)
    .to(collection, to)
    .related(kind);
};

var getRelation = function(collection, key, toCollection, toKey, kind) {
  return db.newGraphReader()
    .get()
    .from(collection, key)
    .to(toCollection, toKey)
    .related(kind);
};

var listRelations = function(collection, from, kinds, withFields, withoutFields) {
  var hasWithFields = typeof(withFields) !== "undefined";
  var hasWithoutFields = typeof(withoutFields) !== "undefined";
  if (hasWithFields && hasWithoutFields) {
    return db.newGraphReader()
      .get()
      .from(collection, from)
      .withFields(withFields)
      .withoutFields(withoutFields)
      .related(kinds);
  } else if (hasWithFields) {
    return db.newGraphReader()
      .get()
      .from(collection, from)
      .withFields(withFields)
      .related(kinds);
  } else if (hasWithoutFields) {
    return db.newGraphReader()
      .get()
      .from(collection, from)
      .withoutFields(withoutFields)
      .related(kinds);
  } else {
    return db.newGraphReader()
      .get()
      .from(collection, from)
      .related(kinds);
    }
};

suite('Graph', function () {
  suiteSetup(function () {
    return users.reset().then(function() { return users.insertAll(); });
  });

  suiteTeardown(function() {
    return db.deleteCollection(users.collection);
  });

  test('Create graph relationships', function() {
    var relations = [
      createRelation(users.collection, users.steve.email, users.kelsey.email, "friend"),
      createRelation(users.collection, users.kelsey.email, users.david.email, "friend")
    ];

    return Q.all(relations)
      .then(function (res) {
        assert.equal(2, res.length);
        for (var i in res) {
          assert.equal(201, res[i].statusCode);
        }
        return Q.resolve(res);
      });
  });

  test('Create graph relationship with properties', function() {

    var properties = [
      { "foo" : "bar" },
      { "bing" : "bong" }
    ];

    var relations = [
      createRelation(users.collection, users.steve.email, users.kelsey.email, "likes", properties[0]),
      createRelation(users.collection, users.kelsey.email, users.david.email, "likes", properties[1])
    ];

    return Q.all(relations)
      .then(function (res) {
        assert.equal(2, res.length);
        // Test that each of the requests succeeded
        for (var i in res) {
          assert.equal(201, res[i].statusCode);
        }

        // Retrieve each of the relations and make sure they contain the correct properties
        return Q.all([
            checkRelationProperties(users.collection, users.steve.email, users.kelsey.email, "likes", properties[0]),
            checkRelationProperties(users.collection, users.kelsey.email, users.david.email, "likes", properties[1])
            ]);
      });
  });

  test('Search for graph relationship', function() {

    var properties = [
      { "foo" : "bar" },
      { "bing" : "bong" }
    ];

    var relations = [
      createRelation(users.collection, users.steve.email, users.kelsey.email, "likes", properties[0]),
      createRelation(users.collection, users.kelsey.email, users.david.email, "likes", properties[1])
    ];

    return Q.all(relations)
      .then(function (res) {
        assert.equal(2, res.length);
        // Test that each of the requests succeeded
        for (var i in res) {
          assert.equal(201, res[i].statusCode);
        }
        // Give search a chance to index relationships
        return Q.delay(3000).then(function() {
          // Retrieve each of the relations and make sure they contain the correct properties
          return Q.all([
              searchForRelationship("@path.source.collection:`" + users.collection + "` AND value.foo:bar", users.steve.email, users.kelsey.email, "likes"),
              searchForRelationship("@path.source.collection:`" + users.collection + "` AND value.bing:bong", users.kelsey.email, users.david.email, "likes")
          ]);
        });
      });
  });

  test('Conditionally create (if-match) graph relationship with properties', function() {

    var kind = "coworkers";

    var properties = [
      { "foo" : "bar" },
      { "fizz" : "buzz" },
      { "bing" : "bong" }
    ];

    var properties2 = [
      { "foo2" : "bar2" },
      { "fizz2" : "buzz2" },
      { "bing2" : "bong2" }
    ];

    var relations = [
      createRelation(users.collection, users.steve.email, users.david.email, kind, properties[0]),
      createRelation(users.collection, users.steve.email, users.kelsey.email, kind, properties[1]),
      createRelation(users.collection, users.kelsey.email, users.david.email, kind, properties[2])
    ];

    return Q.all(relations)
      .then(function (res) {
        assert.equal(3, res.length);
        // Test that each of the requests succeeded
        for (var i in res) {
          assert.equal(201, res[i].statusCode);
        }

        var promises = [];

        promises.push(createRelation(users.collection, users.steve.email, users.david.email, kind, properties2[0], false)
          .then(function() { return Q.reject("Expected if-none-match update to fail."); })
          .fail(function() {
            return checkRelationProperties(users.collection, users.steve.email, users.david.email, kind, properties[0]);
          }));

        promises.push(createRelation(users.collection, users.steve.email, users.kelsey.email, kind, properties2[1], '"ae3dfa4325abe21e"')
          .then(function() { return Q.reject("Expected if-match update to fail."); })
          .fail(function() {
            return checkRelationProperties(users.collection, users.steve.email, users.kelsey.email, kind, properties[1]);
          }));

        promises.push(createRelation(users.collection, users.kelsey.email, users.david.email, kind, properties2[2], res[2].etag)
          .then(function() {
            return checkRelationProperties(users.collection, users.kelsey.email, users.david.email, kind, properties2[2]);
          }));
            
        return Q.all(promises);
      });
  });

  test('Traverse graph relationship', function() {
    return listRelations(users.collection, users.steve.email, [ 'friend', 'friend' ])
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(users.david, res.body.results[0].value);
        return Q.resolve(res);
      });
  });

  test('Traverse graph relationship, with whitelist field filtering', function() {
    return listRelations(users.collection, users.steve.email, [ 'friend', 'friend' ], 'value.name', null)
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual({"name":"David Byrd"}, res.body.results[0].value);
        return Q.resolve(res);
      });
  });

  test('Traverse graph relationship, with blacklist field filtering', function() {
    return listRelations(users.collection, users.steve.email, [ 'friend', 'friend' ], null, [ 'value.email', 'value.location', 'value.type', 'value.gender' ])
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual({"name":"David Byrd"}, res.body.results[0].value);
        return Q.resolve(res);
      });
  });

  test('Delete graph relationship', function() {
    return db.newGraphBuilder()
      .remove()
      .from(users.collection, users.kelsey.email)
      .related('friend')
      .to(users.collection, users.david.email)
      .then(function (res) {
        assert.equal(res.statusCode, 204);
        return db.newGraphReader()
          .get()
          .from(users.collection, users.steve.email)
          .related('friend', 'friend');
      })
      .then(function (res) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.count, 0);
        return Q.resolve(res);
      });
  });

  function checkRelationProperties(collection, fromKey, toKey, kind, properties) {
    return getRelation(collection, fromKey, collection, toKey, kind).then(function(res) {
      assert.deepEqual(res.body, properties);
      return Q.resolve(res);
    });
  }

  function searchForRelationship(query, expectedSourceKey, expectedDestinationKey, expectedKind) {
    return db.newSearchBuilder()
      .kinds('relationship')
      .query(query)
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(1, res.body.count);
        assert.equal(expectedSourceKey, res.body.results[0].path.source.key);
        assert.equal(expectedDestinationKey, res.body.results[0].path.destination.key);
        assert.equal(expectedKind, res.body.results[0].path.relation);
        return Q.resolve(res);
      });
  }

});
