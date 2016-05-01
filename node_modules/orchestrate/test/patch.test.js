// Copyright 2014 Orchestrate, Inc.
/**
 * @fileoverview Test Patch methods.
 */


// Module Dependencies.
var assert = require('assert');
var db = require('./creds')();
var util = require('util');
var Q = require('kew');

var collection = 'patch.test_' + process.version;
var key = 'test-key-1-' + Math.floor(Math.random() * 10000);
// example doc used in all tests. it is reset every before each test.
var orig = {
  "name":"test",
  "age" : 99,
  "tags" : ["coder"],
  "info" : {"email":"test@test.com"}
};

suite('Patch', function () {
  setup(function() {
    return db.put(collection, key, orig)
      .then(function (res){
        assert.equal(201, res.statusCode);
        return Q.resolve(res);
      });
  });

  test('Add field', function () {
    return db.newPatchBuilder(collection, key)
      .add("email","test@test.com")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal("test@test.com", res.body.email);
        return Q.resolve(res);
      });
  });

  test('Remove field', function () {
    return db.newPatchBuilder(collection, key)
      .remove("name")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert(typeof res.body.name === 'undefined');
        return Q.resolve(res);
      });
  });

  test('Remove field fails when not found', function () {
    return db.newPatchBuilder(collection, key)
      .remove("some_missing_field_name")
      .apply()
      .then(function (res) {
        Q.reject("Should have failed with a 409.");
      })
      .fail(function (e) {
        return Q.resolve(e);
      });
  });

  test('Replace field', function () {
    return db.newPatchBuilder(collection, key)
      .replace("name", "name 2")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('name 2', res.body.name);
        return Q.resolve(res);
      });
  });

  test('Move field', function () {
    return db.newPatchBuilder(collection, key)
      .move("name", "fullName")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert(typeof res.body.name === 'undefined');
        assert.equal('test', res.body.fullName);
        return Q.resolve(res);
      });
  });

  test('Copy field', function () {
    return db.newPatchBuilder(collection, key)
      .copy("name", "fullName")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test', res.body.name);
        assert.equal('test', res.body.fullName);
        return Q.resolve(res);
      });
  });

  test('Increment field', function () {
    return db.newPatchBuilder(collection, key)
      .inc("age")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(100, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Increment field by value', function () {
    return db.newPatchBuilder(collection, key)
      .inc("age", 100)
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(199, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Test field', function () {
    return db.newPatchBuilder(collection, key)
      .test("name", "test")
      .inc("age")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(100, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Patch not applied when Test op fails', function () {
    return db.newPatchBuilder(collection, key)
      .test("name", "foo")
      .inc("age")
      .apply()
      .then(function (res) {
        return Q.reject("Should have failed with 409");
      })
      .fail(function (e) {
        assert.equal(409, e.statusCode);
        return db.get(collection, key)
          .then(function(res2) {
            assert.equal(200, res2.statusCode);
            assert.equal(99, res2.body.age);
            return Q.resolve(res2);
          });
      });
  });

  test('Test field with negation', function () {
    return db.newPatchBuilder(collection, key)
      .testNot("name", "foo")
      .inc("age")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal(100, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Init field', function () {
    return db.newPatchBuilder(collection, key)
      .init("profile", {"email":"foo@foo.com"})
      .add("profile.description", "test")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('foo@foo.com', res.body.profile.email);
        assert.equal('test', res.body.profile.description);
        return Q.resolve(res);
      });
  });

  test('Init field does nothing when field already present', function () {
    return db.newPatchBuilder(collection, key)
      .init("info", {"email":"foo@foo.com"})
      .add("info.description", "test")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        // email should be the original, since init op will do nothing when
        // the field is already present.
        assert.equal('test@test.com', res.body.info.email);
        assert.equal('test', res.body.info.description);
        return Q.resolve(res);
      });
  });

  test('Append value to array', function () {
    return db.newPatchBuilder(collection, key)
      .append("tags", "deranged")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(['coder', 'deranged'], res.body.tags);
        return Q.resolve(res);
      });
  });

  test('Append multiple values to array', function () {
    return db.newPatchBuilder(collection, key)
      .append("tags", ["deranged","coffee"])
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.deepEqual(['coder', 'deranged', 'coffee'], res.body.tags);
        return Q.resolve(res);
      });
  });

  test('Merge object into field value', function () {
    return db.newPatchBuilder(collection, key)
      .merge("info", {"description":"coffee"})
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test@test.com', res.body.info.email);
        assert.equal('coffee', res.body.info.description);
        return Q.resolve(res);
      });
  });

  test('Nested Patch applied to field value', function () {
    return db.newPatchBuilder(collection, key)
      .patch("info", [{"op":"add","path":"description","value":"coffee"}])
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test@test.com', res.body.info.email);
        assert.equal('coffee', res.body.info.description);
        return Q.resolve(res);
      });
  });

  test('Nested Patch with builder', function () {
    return db.newPatchBuilder(collection, key)
      .patch("info", db.newPatchBuilder()
          .add("description", "coffee")
      )
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test@test.com', res.body.info.email);
        assert.equal('coffee', res.body.info.description);
        return Q.resolve(res);
      });
  });

  test('Nested Patch with conditional test', function () {
    // conditional nested patches only apply if all the inner patch test ops pass
    var nested = db.newPatchBuilder()
      .test("email","test@test.com")
      .add("description", "coffee");

    return db.newPatchBuilder(collection, key)
      .patch("info", nested, true)
      .inc("age")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test@test.com', res.body.info.email);
        assert.equal('coffee', res.body.info.description);
        assert.equal(100, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Nested Patch with failing conditional test does not apply', function () {
    // conditional nested patches only apply if all the inner patch test ops pass
    var nested = db.newPatchBuilder()
      .test("email","foo") // this test op will not pass
      .add("description", "coffee");

    return db.newPatchBuilder(collection, key)
      .patch("info", nested, true)
      .inc("age")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test@test.com', res.body.info.email);
        // description was NOT set because the conditional patch did not apply
        assert(typeof res.body.info.description === 'undefined');
        // but the inc op following the conditional nested patch DOES still apply
        // because the conditional patch does not FAIL the overall patch.
        assert.equal(100, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Nested Patch via patchIf', function () {
    return db.newPatchBuilder(collection, key)
      // patchIf is just a convenience method to create a conditional nested patch
      .patchIf("info", db.newPatchBuilder()
        .test("email","foo")
        .add("description", "coffee")
      )
      .inc("age")
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal('test@test.com', res.body.info.email);
        // description was NOT set because the conditional patch did not apply
        assert(typeof res.body.info.description === 'undefined');
        // but the inc op following the conditional nested patch DOES still apply
        // because the conditional patch does not FAIL the overall patch.
        assert.equal(100, res.body.age);
        return Q.resolve(res);
      });
  });

  test('Upsert with patch ops', function () {
    var key2 = key + "_2";

    return db.newPatchBuilder(collection, key2)
      .add("email","test@test.com")
      .upsert(true)
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key2);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        // ONLY email is set, since this patch was an upsert to a new key.
        assert.deepEqual({"email":"test@test.com"}, res.body);
        return Q.resolve(res);
      });
  });

  test('Upsert just applies as patch if item already present', function () {
    return db.newPatchBuilder(collection, key)
      .add("email","test@test.com")
      .upsert(true)
      .apply()
      .then(function (res) {
        assert.equal(201, res.statusCode);
        return db.get(collection, key);
      })
      .then(function (res) {
        assert.equal(200, res.statusCode);
        assert.equal("test@test.com", res.body.email);
        assert.equal(99, res.body.age);
        return Q.resolve(res);
      });
  });
});
