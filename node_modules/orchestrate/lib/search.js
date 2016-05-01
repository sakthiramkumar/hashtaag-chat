// Copyright 2013 Bowery Software, LLC
/**
 * @fileoverview Search builder.
 */


// Module Dependencies.
var assert = require('assert')
var Builder = require('./builder')
var BucketBuilder = require('./bucket_builder');

/**
 * @constructor
 */
function SearchBuilder () {
  this._sortClauses = [];
}

var util = require('util');
util.inherits(SearchBuilder, Builder)


/**
 * Set collection.
 * @param {string} collection
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.collection = function (collection) {
  assert(collection, 'Collection required.')
  this._collection = collection
  return this
}


/**
 * Set limit.
 * @param {number} limit
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.limit = function (limit) {
  assert(limit, 'Limit required.')
  this._limit = limit
  return this
}


/**
 * Set offset.
 * @param {number} offset
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.offset = function (offset) {
  assert.equal(typeof offset, 'number', 'Offset required.')
  this._offset = offset
  return this
}


/**
 * Set sort.
 * @param {string} field
 * @param {string} order
 * @return {SearchBuilder}
 * @deprecated Use sortBy() with fully qualified field names.
 */
SearchBuilder.prototype.sort = function (field, order) {
  assert(field, 'field required');
  assert(order, 'order required');
  if (field.indexOf('@path.') != 0) {
    // TODO we should NOT be doing this default prefixing!
    // removing will be a breaking change.
    field = 'value.' + field;
  }
  var sortClause = field + ':' + order;
  return this.sortBy(sortClause);
}

/**
 * Add random sort clause with an optional seed value.
 * @param {string=} seedValue Seed to use for random sorting (optional).
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.sortRandom = function (seedValue) {
  var sortClause = "_random";
  if (typeof(seedValue) !== "undefined") {
    sortClause = sortClause + ":" + seedValue;
  }
  return this.sortBy(sortClause);
}

/**
 * Add sort clauses.
 * @example
 * // adds a sort clause for the field value.age
 * searchBuilder.sortBy('value.age');
 * @example
 * // adds two sorts clauses for the field value.age and @path.key
 * searchBuilder.sortBy('value.age', '@path.key');
 * @example
 * // adds a sort clause for the field value.age in ascending order
 * searchBuilder.sortBy('value.age:asc');
 * @param {...string} sortClauses Sort clauses to add to the request.
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.sortBy = function () {
  for(var i = 0; i < arguments.length; ++i) {
    this._sortClauses.push(arguments[i]);
  }
  return this;
}

/**
 * Enable field-filtering, with a whitelist of field names
 * @example
 * // adds a whitelist field-filter for the field value.age
 * searchBuilder.withFields('value.age');
 * @example
 * // adds two whitelist field-filters, for the fields value.name and value.age
 * searchBuilder.withFields('value.name', 'value.age');
 * @param {...string} fieldNames Fully-qualified field names to use as whitelist field-filters
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.withFields = function () {
  this.filterWithFields = this.filterWithFields || [];
  this.filterWithFields = this.filterWithFields.concat(Array.prototype.slice.call(arguments));
  return this;
}

/**
 * Enable field-filtering, with a blacklist of field names
 * @example
 * // adds a blacklist field-filter for the field value.age
 * searchBuilder.withoutFields('value.age');
 * @example
 * // adds two blacklist field-filters, for the fields value.name and value.age
 * searchBuilder.withoutFields('value.name', 'value.age');
 * @param {...string} fieldNames Fully-qualified field names to use as blacklist field-filters
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.withoutFields = function () {
  this.filterWithoutFields = this.filterWithoutFields || [];
  this.filterWithoutFields = this.filterWithoutFields.concat(Array.prototype.slice.call(arguments));
  return this;
}


/**
 * Add new aggregate parameter.
 * @param {string} type
 * @param {string} path
 * @param {array} args
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.aggregate = function (type, path, args) {
  assert(type, 'type required');
  assert(path, 'path required');
  var parts = [ path, type ];
  if (typeof(args) === "string" || util.isArray(args)) {
    parts = parts.concat(args);
  }
  var _aggregate = parts.join(':');
  if (this._aggregate)
    this._aggregate = [this._aggregate, _aggregate].join(',');
  else
    this._aggregate = _aggregate;
  return this;
}

/**
 * Add new 'top_values' aggregate parameter.
 * @param {string} path
 * @param {number} offset
 * @param {number} limit
 * @return {SearchBuilder}
 */
 SearchBuilder.prototype.top_values = function (path, offset, limit) {
  if (typeof(offset) !== "undefined" && typeof(limit) !== "undefined") {
    return this.aggregate('top_values', path, "offset", offset, "limit", limit);
  }
  assert(
    typeof(offset) === "undefined" && typeof(limit) === "undefined",
    "offset or limit params must be included together, or not at all"
  );
  return this.aggregate('top_values', path);
 }

/**
 * Add new 'stats' aggregate parameter.
 * @param {string} path
 * @return {SearchBuilder}
 */
 SearchBuilder.prototype.stats = function (path) {
  return this.aggregate('stats', path);
 }

 /**
 * Add new 'range' aggregate parameter.
 * @param {string} path
 * @param {array|function} buckets
 * @return {SearchBuilder}
 */
 SearchBuilder.prototype.range = function (path, buckets) {
  var _buckets = buckets;
  if (typeof(buckets) === 'function') {
    _buckets = buckets(new BucketBuilder());
    if (_buckets.build) _buckets = _buckets.build();
  }

  return this.aggregate('range', path, _buckets);
 }

 /**
 * Add new 'distance' aggregate parameter.
 * @param {string} path
 * @param {array|function} buckets
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.distance = function (path, buckets) {
  var _buckets = buckets;
  if (typeof(buckets) === 'function') {
    _buckets = buckets(new BucketBuilder());
    if (_buckets.build) _buckets = _buckets.build();
  }

  return this.aggregate('distance', path, _buckets);
 }

 /**
 * Add new 'time_series' aggregate parameter. The 'time' param, which must be
 * one of ('year', 'quarter', 'month', 'week', 'day', or 'hour'), determines
 * the bucketing interval for the time-series. The optional timezone param,
 * if present, must begin with a "+" or "-" character, followed by four digits
 * representing the hours and minutes of offset, relative to UTC. For example,
 * Eastern Standard Time (EST) would be represented as "-0500", since the time
 * in EST is five hours behind that of UTC.
 *
 * @param {string} path
 * @param {string} time
 * @param {string} timezone
 * @return {SearchBuilder}
 */
 SearchBuilder.prototype.time_series = function (path, time, timezone) {
  if (typeof(timezone) === "undefined") {
    return this.aggregate('time_series', path, time);
  } else {
    return this.aggregate('time_series', path, [ time, timezone ]);
  }
 }

 /**
  * Sets the 'kind' to search. Currently, Orchestrate defaults to
  * searching only kv 'item's in the collection. To search only
  * 'event' objects in the collection:
  * searchBuilder.kinds('event')
  * To search both 'event' and 'item' kinds, call with both:
  * searchBuilder.kinds('item', 'event')
  *
  * @param {string} The Orchestrate 'kind' to be included ('item' or 'event').
  * @return {SearchBuilder}
  */
 SearchBuilder.prototype.kinds = function () {
   var kinds = []
   assert(arguments.length > 0, 'At least one kind required.')
   for (var i=0; i<arguments.length; i++) {
     var kind = arguments[i]
     assert(kind === 'event' || kind === 'item' || kind === 'relationship', "'item', 'event', or 'relationship' required.")
     kinds.push(kind)
   }
   this._kinds = kinds
   return this
}

/**
 * Set query and send the search request to Orchestrate.
 *
 * @param {string} query
 * @return {SearchBuilder}
 */
SearchBuilder.prototype.query = function (query) {
  assert(query, 'Query required.')
  this._query = query
  return this._execute('get')
}


/**
 * Execute search.
 * @return {Object}
 * @protected
 */
SearchBuilder.prototype._execute = function (method) {
  assert(this._query, 'Query required.')
  var pathArgs = []
  if (this._collection) {
    pathArgs.push(this._collection);
  }
  var query = this._query
  if (this._kinds) {
    query = '@path.kind:('+this._kinds.join(' ')+') AND (' + this._query + ')'
  }
  var url = this.getDelegate() && this.getDelegate().generateApiUrl(pathArgs, {
    query: query,
    limit: this._limit,
    offset: this._offset,
    sort: this._generateSort(),
    aggregate: this._aggregate,
    with_fields: this.filterWithFields,
    without_fields: this.filterWithoutFields
  })

  return this.getDelegate()['_' + method](url)
}

SearchBuilder.prototype._generateSort = function () {
  if (this._sortClauses.length > 0) {
    return this._sortClauses.join(",");
  }
}



// Module Exports.
module.exports = SearchBuilder
