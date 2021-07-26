import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';

import { Format, cardJSONReponse } from '@cardstack/core/src/interfaces';
import type CardModel from '@cardstack/core/src/card-model';
import config from 'cardhost/config/environment';

const { cardServer } = config as any; // Environment types arent working

// TODO: This is hardcoded for now. We need to decide how this should work.
const REALM = 'https://demo.com';

export interface Card {
  model: CardModel;
  component: unknown;
}

function buildCardURL(url: string, format?: Format): string {
  let fullURL = [cardServer, 'cards/', encodeURIComponent(url)];
  if (format) {
    fullURL.push('?' + new URLSearchParams({ format }).toString());
  }
  return fullURL.join('');
}

function buildNewURL(realm: string, parentCardURL: string): string {
  return [
    cardServer,
    'cards/',
    encodeURIComponent(realm) + '/',
    encodeURIComponent(parentCardURL),
  ].join('');
}

// when you put a card under edit, we load a new copy in edit mode. This lets us
// look up the original copy from the editable copy.
let originals = new WeakMap();

export default class Cards extends Service {
  async load(url: string, format: Format): Promise<Card> {
    let fullURL = buildCardURL(url, format);
    return taskFor(this.internalLoad).perform(fullURL);
  }

  async loadForRoute(pathname: string): Promise<Card> {
    return taskFor(this.internalLoad).perform(
      `${cardServer}cardFor${pathname}`
    );
  }

  async loadForEdit(card: Card): Promise<Card> {
    let loaded = await taskFor(this.internalLoad).perform(
      buildCardURL(card.model.url, 'edit')
    );
    originals.set(loaded.model, card.model);

    return loaded;
  }
  async loadForNew(card: Card): Promise<Card> {
    let loaded = await taskFor(this.internalLoad).perform(
      buildCardURL(card.model.url, 'edit'),
      { dataShapeOnly: true }
    );
    originals.set(loaded.model, card.model);

    return loaded;
  }

  @task private *internalLoad(
    url: string,
    options?: { dataShapeOnly: boolean }
  ): TaskGenerator<Card> {
    let cardResponse = yield fetchCard(url);
    let { component, ModelClass } = yield loadComponentModule(
      cardResponse,
      url
    );

    let model =
      options && options.dataShapeOnly
        ? ModelClass.newFromParentCardResponse(ModelClass, cardResponse)
        : ModelClass.newFromResponse(ModelClass, cardResponse);

    return {
      model,
      component: buildCallerComponent(model, component),
    };
  }

  async save(card: Card): Promise<void> {
    await taskFor(this.saveTask).perform(card.model);

    let original = originals.get(card.model);
    if (original) {
      // TODO: this should probably be selective and only update fields that
      // already appear in original (which will be a subset of the editable
      // card)
      original.setters(card.model.data);
    }
  }

  @task private *saveTask(model: CardModel): TaskGenerator<void> {
    // TODO: Need to consider what is responsible for
    // determinaing the URL and the current state of the CardModel.
    if (model.url) {
      let url = buildCardURL(model.url);
      let response = yield fetchCard(url, {
        method: 'PATCH',
        body: JSON.stringify(model.serialize()),
      });
      model.updateFromResponse(response);
    } else if (model.parentCardUrl) {
      let url = buildNewURL(REALM, model.parentCardUrl);
      let response = yield fetchCard(url, {
        method: 'POST',
        body: JSON.stringify(model.serialize()),
      });
      model.updateFromResponse(response);
    }
  }
}

function buildCallerComponent(model: CardModel, component: unknown): unknown {
  return setComponentTemplate(
    hbs`<this.card @model={{this.model.data}} @set={{this.model.setters}} />`,
    class extends Component {
      model = model;
      card = component;
    }
  );
}

async function loadComponentModule(
  card: cardJSONReponse,
  url: string
): Promise<{ component: unknown; ModelClass: typeof CardModel }> {
  let { meta } = card.data;

  if (!meta || !meta.componentModule) {
    throw new Error('No componentModule to load');
  }

  let { componentModule } = meta;

  // TODO: base this on the componentModuleName prefix instead of isTesting()
  if (macroCondition(isTesting())) {
    // in tests, our fake server inside mirage just defines these modules
    // dynamically
    let cardComponentModule = window.require(componentModule);
    return {
      component: cardComponentModule['default'],
      ModelClass: cardComponentModule['Model'],
    };
  } else {
    if (!componentModule.startsWith('@cardstack/compiled/')) {
      throw new Error(
        `${url}'s meta.componentModule does not start with '@cardstack/compiled/`
      );
    }
    componentModule = componentModule.replace('@cardstack/compiled/', '');
    let cardComponentModule = await import(
      /* webpackExclude: /schema\.js$/ */
      `@cardstack/compiled/${componentModule}`
    );

    return {
      component: cardComponentModule.default,
      ModelClass: cardComponentModule.Model,
    };
  }
}

async function fetchCard(
  url: string,
  options: any = {}
): Promise<cardJSONReponse> {
  let fullOptions = Object.assign(
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    options
  );
  let response = await fetch(url, fullOptions);

  if (!response.ok) {
    throw new Error(`unable to fetch card ${url}: status ${response.status}`);
  }

  return await response.json();
}
