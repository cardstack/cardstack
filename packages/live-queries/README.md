# @cardstack/live-queries

This addon integrates with the cardstack hub to give you "live" queries
– ones which automatically refresh when records have updated on the
server.

## Installation

```
yarn add @cardstack/live-queries
```

## Usage
```js
// some component.js
import Component from "@ember/component";
import { liveQuery } from "@cardstack/live-queries";

export default Component.extend({
  sortField: 'updatedAt',
  sortOrder: 'desc',
  items: liveQuery('sortField', 'sortOrder', function(sortField, sortOrder) {
    let sort = (sortOrder === 'desc') ? `-${sortField}` : sortField;
    return {
      type: "item",
      query: { sort }
    };
  })
});
```

`items` is now a computed property for an Ember Data query – it returns
a Promise for an [`AdapterPopulatedRecordArray`][RecordArray], just
like [`Store#query`][Store#query]. When events come in that require
refreshing the query, we simply call [`update`][RecordArray#update] on
it. If the dependent keys change, we create a whole new query.

At the moment, you can only use this on Components, because we use the
lifecycle hooks to manage update subscriptions to the backend.

## Configuration
By default, this plugin starts a socket.io server on port `3100`.
If you'd like, you can change this to another port by specifying
`socket-port` in a `plugin-config` in your seed models:

```js
// cardstack/seeds/development/config.js
module.exports = {
  type: 'plugin-configs',
  id: '@cardstack/live-queries',
  attributes: {
    'socket-port': 3200
  }
};
```


## TODO
- Improve refresh granularity
- Add passing only an object for simple, non-computed queries
- Add support for proper lifecycle on routes, maybe controllers, maybe services?
- Document using subscriptions directly, when you want to do something
  more custom than just keeping a `RecordArray` up to date.
- Document event-only (doesn't query for you - for when you want to do
  something besides just update the record array)
- Extract @cardstack/socket


[RecordArray]: https://emberjs.com/api/ember-data/2.16/classes/DS.AdapterPopulatedRecordArray
[Store#query]: https://emberjs.com/api/ember-data/2.16/classes/DS.Store/methods/query?anchor=query
[RecordArray#update]: https://emberjs.com/api/ember-data/2.16/classes/DS.AdapterPopulatedRecordArray/methods/update?anchor=update
