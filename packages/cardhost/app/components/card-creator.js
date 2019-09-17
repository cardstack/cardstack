import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { task } from "ember-concurrency";
import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment';

export default class CardCreator extends Component {
  @service router;

  @tracked repository = 'local-hub';
  @tracked packageName = 'article-card';
  @tracked cardId = 'millenial-puppies';
  @tracked statusMsg;
  @tracked card;

  constructor(...args) {
    super(...args);

    this.card = JSON.stringify({
      data: {
        type: 'cards',
        id: 'local-hub::article-card::millenial-puppies',
        attributes: {
          'isolated-js': '',
          'isolated-template': '',
          'isolated-css': '',
          'embedded-js': '',
          'embedded-template': '',
          'embedded-css': '',
        },
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'local-hub::article-card::millenial-puppies::title' },
              { type: 'fields', id: 'local-hub::article-card::millenial-puppies::author' },
              { type: 'fields', id: 'local-hub::article-card::millenial-puppies::body' },
              { type: 'fields', id: 'local-hub::article-card::millenial-puppies::internal-field' },
            ]
          },
          model: {
            data: { type: 'local-hub::article-card::millenial-puppies', id: 'local-hub::article-card::millenial-puppies' }
          }
        }
      },
      included: [{
        type: 'local-hub::article-card::millenial-puppies',
        id: 'local-hub::article-card::millenial-puppies',
        attributes: {
          'internal-field': 'this is internal data',
          'title': 'The Millenial Puppy',
          'author': 'Van Gogh',
          'body': `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`
        },
      },
      {
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::title',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        },
      },
      {
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::author',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::body',
        attributes: {
          'is-metadata': true,
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::internal-field',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
      ]
    }, null, 2);
  }

  @task(function * () {
    let json;
    this.statusMsg = null;
    if (!ciSessionId) {
      this.statusMsg = `You must run the hub with the environment variable HUB_ENVIRONMENT=test in order for the hub to provide a session that can be used for the test harness to create cards with.`;
      throw new Error(this.statusMsg);
    }
    try {
      let response = yield fetch(`${hubURL}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${ciSessionId}`
        },
        body: this.card
      });
      json = yield response.json();
      if (!response.ok) {
        this.statusMsg = `Error creating card: ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`;
        return;
      }
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = e.message;
      return;
    }

    let cardData = JSON.parse(this.card);
    if (json.data.id === cardData.data.id && json.data.type === 'cards') {
      this.router.transitionTo('cards.update', json.data.id);
    } else {
      this.statusMsg = `card ${cardData.data.id} was NOT successfully created`;
    }
  }) createCard;

  @action
  create() {
    try {
      JSON.parse(this.card)
    } catch (e) {
      this.statusMsg = `The card data is invalid JSON`;
      return;
    }

    this.createCard.perform();
  }
}