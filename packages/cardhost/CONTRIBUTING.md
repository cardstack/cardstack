# How to Contribute

## Writing tests

When writing tests for the Cardstack Builder, it is important to not leak state, and to understand which tools are available for setup and teardown.
This section describes the general approach and test helpers.

### Types of acceptance tests

The tests are divided into tests that modify the system, and tests that introspect the system.

A test that modifies the system (creates a Card) should use `moduleSetup`.

A test that is for introspection of the system (navigating around the app) should use `testSetup`.

To help make the tests as efficient as possible, we recommend that you group your tests into "read-only" tests and "mutating" tests. 

### Preventing leaks with Fixtures

The rule of thumb is that you need to make sure that your test returns the state of the system back to the state that was in when the test started. This means that, if within your test, a card is created, you need to make sure that it is cleaned up when the test is done. There should be no net change in the cumulative number of cards that exist the in database in between each test, or that cards that do exist globally (like realm cards) remain unchanged after the test concludes. This inclides adopting a card; it is a form of card creation, which means that you must take care of the card cleanup when the test concludes. 

To support this, we have a very unique mechanism in our test framework (because we are testing against a live DB) that allows us to control the cards in the DB between each test. This includes logic to create cards that your tests depend on, as well as to remove cards created within your tests. This is our `Fixtures` system.

In our tests you can create scenarios by instantiating a `Fixture` and then specifying the cards that should exist before the test is run, as well as cards that should be removed that were created in the course of running your test. Any cards that you tell the system that you need to be created before the test is run will automatically be removed for you--you don't need to say anything special to remove these cards. For tear down you only need to tell the Fixture about the cards created by your test itself (like a test that creates cards). 

#### Create

To specify cards to create in your Fixture (that you'll rely upon within your tests), use the `create` property in the fixture configuration (Typescript will help you here). The `create` property accepts an array of `CardDocument` objects that specify the cards you want to create (and these will be torn down for you automatically).

#### Destroy

To specify cards to destroy after the test is done running in your Fixture, use either the `destroy.cards` property in the Fixture constructor to specify an array of `CardId`'s to destroy, or use `destroy.cardTypes` to specify the an array of card parents whose adopted children you want to destroy. And again, what you are specifying here are not the cards you specified in the create hook--those are cleaned up automatically, its the cards that were created in the test itself that need to be cleared out.

#### When to run fixtures

The next thing to be cognizant of is _when_ the Fixtures are run: do you want them to run in between each test? or do you want them run once at the beginning of the test module, and once at the end of the test module. The reason we give you a choice is that the work to setup and teardown the test requires web request for each card to create and each card to destroy. Depending on your tests, the cumulative amount of time it takes to issue these cause could be very large (lots of tests or lots of cards for the tests, or a combination of lots of tests using lots of cards).
For these same reasons, we recommend that you group your tests into "read-only" tests and "mutating" tests. 

### Read-only tests

The read-only tests are tests that don't actually change any system data. They are tests where you are just navigating around the system and making sure the correct things appear in the various routes or card states. All the system configuration in terms of setting up the testing scenario occurs within the Fixture, and the test is basically just poking around looking at things, but not changing any card data, like the library tests, or card view tests. In this scenario you can greatly speed up the time it takes to run the tests by having all the tests just reuse the same cards without creating the cards from the fixtures or cleaning up the cards from the fixtures in between each test--since the promise is that the test wont alter that card data. In this case we use:
```js
scenario.setupModule(hooks);
```
to setup the Fixtures. `setupModule()` means that we only setup the fixture at the module boundary, not the test boundary. 

### Mutating tests

The mutating tests are tests that actually change card data--they may create cards, update cards, or delete cards--but the fundamental thing is that they are changing the state of the application within the tests themselves. These tests need to create the cards from the fixture and teardown the cards from the fixture (plus any other cards that were created in the tests themselves) after each individual test.
For these tests you can use:

```js
scenario.setupTest(hooks);
```
to setup the Fixtures. `setupTest()` means that we setup the fixture at the individual test boundary.

### Hybrid tests

Some tests actually layer together mutating and read-only tests (like the adoption tests). For the `adopt-card-test.js` we never alter the parent card--that is held static throughout all the test. So we use a Fixture to govern the setup of the parent card specifically that is a module scoped Fixture (does't run in between each test). This prevents us from having to expend the extra time to create and destroy the parent card in between each test, since we never change that anyways. Then, since the adoption tests actually do create new cards within the tests themselves--but cards that specifically only ever extend from the parent card that we'd defined, we use a Fixture that deletes all the cards that adopt from the parent that is a test scoped Fixture (so it runs in between each individual test).

### Why are these steps necessary?

Since we are doing full end-to-end testing, where we touch a live database, we need to be really careful about cleaning up after ourselves, otherwise state will leak into other tests.
This is different than most front-end test suites that use mocks for their API interactions.

### How do you know you have a leaky test?

Anytime you see a test that runs successfully in isolation, but fails when run with other tests is in this scenario: where state is leaking into other tests. The state may be data-based, or async based (promise that is not being awaited).
