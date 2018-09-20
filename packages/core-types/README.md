# @cardstack/core-types

The core-types package describes the field types available to Cardstack models. Example usage is:
```
factory.addResource('fields', 'my-field').withAttributes({
  fieldType: '@cardstack/core-types::<field-type>',
  ...
})
```
where `<field-type>` is one of:
* `string` _(ex. `"sandwich", "Dave"`)_
* `string-array` _(ex. `["red", "green", "blue"]`)_
* `case-insensitive` case insensitive string, used for email addresses, among other things _(ex. `"ChRiS.tSe@GmaiL.com"`)_
* `integer` _(ex. `37`)_
* `boolean` _(ex. `true`)_
* `date` _(ex. `"2018-07-22"`)_
* `object` _(ex. `{ flower: 'rose' }`)_
* `any` any data type, useful for external data sources
* `belongs-to` belongs to relationship to another content-type _(ex. `"author"`)_
* `has-many` has many relationship to another content-type _(ex. `"pets"`)_

## Field Editors

When using the Cardstack Tools for editing, it will use the appropriate field editor for that type. For example, if your `fieldType` is `@cardstack/core-types::string`, the `field-editors/string-editor` (which is essentially just a bound `<input type="text">`) will be used. The core-types package contains several built-in field editors (`string`, `integer`, `date`, etc), but you can specify your own custom field editor by specifying `editorComponent`. This is particularly useful for relationship field types, for which there may not be a "standard" UI:
```
factory.addResource('fields', 'author').withAttributes({
  fieldType: '@cardstack/core-types::belongs-to',
  editorComponent: 'field-editors/author-picker'
})
```
Additionally, you can pass options to field editors using `editorOptions`:
```
factory.addResource('fields', 'is-admin-user').withAttributes({
  fieldType: '@cardstack/core-types::boolean',
  editorOptions: { style: 'switch' }
})
```


## Installation

* `git clone <repository-url>` this repository
* `cd @cardstack/core-types`
* `npm install`
* `bower install`

## Running

* `ember serve`
* Visit your app at [http://localhost:4200](http://localhost:4200).

## Running Tests

* `npm test` (Runs `ember try:each` to test your addon against multiple Ember versions)
* `ember test`
* `ember test --server`

## Building

* `ember build`

For more information on using ember-cli, visit [https://ember-cli.com/](https://ember-cli.com/).
