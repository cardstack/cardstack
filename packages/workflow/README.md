# @cardstack/workflow

The workflow package gives host apps a workflow system where each workflow can
have a priority (which might change over time) and several tags.

It displays a notification counter and, when opened, a couple of panels to see
the workflows grouped by priority and by tag. It allows to see at a glance
which workflows need to be acted on, and then act on them.

## The cardstack-workflow service and component

Host apps need to render the `{{cardstack-workflow}}` component where they want
the workflow panels to appear (preferably in the left edge of the screen).

The component accesses data through the `cardstack-workflow` service which also
defines the following methods for the host app to use:

* `createThread(message1, message2, ...)`
* `createMessageFor(cardModel, properties)`

Creating a message for each card model in your application is required (the
workflows work with messages under the hood) and is supported by the
`createMessageFor` method above.

(We'll probably need a 3rd method to get the thread for a given card model).

Let's see an example.

Assume you have a rental model in your application and the corresponding card
model, `rental-card`. To create a workflow where a new rental is offered, you'd
do as follows:

```js

workflow: inject('cardstack-workflow'),

let urgent = this.get('store').queryRecord('priority', { name: 'urgent' });
let bayArea = this.get('store').queryRecord('tag', { name: 'Bay Area' });

let rentalCard = this.get('store').createRecord('rental-card');

rentalCard.save(() => {
  let message = this.get('workflow').createMessageFor(rentalCard, {
    priority: urgent,
    tags: [ bayArea ],
  });
  return this.get('workflow').createThread(message);
});
```

In your app you define your models and then use the above methods to create a
workflow around them.

For a detailed example, see the dummy app in this package.

## Card models in the host app

We've already seen an example of a card model, `rental-card` in the previous example.

Card models should be domain-specific and need only to have one single property to interface
with the workflow package. The property is named `is-cue-card` and only card types that need
to appear in the workflow list view need to have it and need to set it to a truthy value.

The latest card model with a truthy `isCueCard` property in a thread will
represent it by having its list-card format rendered. So if your model is called
`rental-card`, then a `cardstack/rental-card-list-card` component will be
rendered in the list view.

## Installation

* `git clone <repository-url>` this repository
* `cd @cardstack/workflow`
* `yarn install`

## Running

* `DEBUG=cardstack/* DEBUG_LEVEL=info ember s
* Visit your app at [http://localhost:4200](http://localhost:4200).

## Running Tests

Run tests locally:

* `ember test --server`

TravisCI runs the tests for each ember version listed in `.travis.yml`.

## Building

* `ember build`

For more information on using ember-cli, visit [https://ember-cli.com/](https://ember-cli.com/).
