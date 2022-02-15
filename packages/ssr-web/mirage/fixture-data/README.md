Fixture data is always loaded in tests because of a bug:

https://github.com/miragejs/ember-cli-mirage/issues/1909

If we use fixture data that is loaded because of this bug, it risks tests breaking for no clear reason if this is fixed in `ember-cli-mirage`. If we load fixtures ourselves to prevent this, we will get double the fixtures.
