- 0.8.0: 2016-02-17
 * Added 'withFields' and 'withoutFields' field-filtering functions to the
   SearchBuilder, EventBuilder, and GraphBuilder APIs.
- 0.7.0: 2015-12-23
 * Add `sortBy` to `SearchBuilder` which should be preferred over `sort` but
   requires fully qualified field names (i.e. prefixed with `value` or `@path`)
 * Add `sortRandom` which is the same as `sortBy("_random")`
