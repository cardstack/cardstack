import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from "ember-concurrency";
import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment';

export default class CardCreator extends Component {
  @tracked statusMsg;
  @tracked card;
  @tracked id;
  @tracked packageName;

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
              { type: 'fields', id: 'local-hub::article-card::millenial-puppies::tags' },
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
          'local-hub::article-card::millenial-puppies::internal-field': 'this is internal data',
          'local-hub::article-card::millenial-puppies::title': 'The Millenial Puppy',
          'local-hub::article-card::millenial-puppies::author': 'Van Gogh',
          'local-hub::article-card::millenial-puppies::body': `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`
        },
        relationships: {
          'local-hub::article-card::millenial-puppies::tags': {
            data: [
              { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
              { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
              { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
            ]
          }
        }
      },
      {
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::title',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        },
        relationships: {
          contraints: {
            data: [
              { type: 'constraints', id: 'local-hub::article-card::millenial-puppies::title-not-null' }
            ]
          }
        }
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
      {
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::tags',
        attributes: {
          'is-metadata': true,
          'field-type': '@cardstack/core-types::has-many'
        },
        relationships: {
          'related-types': {
            data: [{ type: 'content-types', id: 'local-hub::article-card::millenial-puppies::tags'} ]
          }
        }
      },
      {
        type: 'content-types',
        id: 'local-hub::article-card::millenial-puppies::tags'
      },
      {
        type: 'constaints',
        id: 'local-hub::article-card::millenial-puppies::title-not-null',
        attributes: {
          'constraint-type': '@cardstack/core-types::not-null',
          'error-message': 'The title must not be empty.'
        }
      }
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
      }
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = e.message;
      return;
    }

    let cardData = JSON.parse(this.card);
    if (json.data.id === cardData.data.id && json.data.type === 'cards') {
      this.statusMsg `card ${json.data.id} was successfully created`
      // TODO transition to the "card update" route with the new card
    } else {
      this.statusMsg `card ${cardData.data.id} was NOT successfully created`
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