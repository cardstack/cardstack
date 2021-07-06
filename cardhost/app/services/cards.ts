import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { Format, cardJSONReponse } from '@cardstack/core/src/interfaces';
import type CardModel from '@cardstack/core/src/base-component-model';
import config from 'cardhost/config/environment';

const { cardServer } = config as any; // Environment types arent working

export interface Card {
  model: CardModel;
  component: unknown;
}

function buildURL(url: string, format?: Format): string {
  let fullURL = [cardServer, 'cards/', encodeURIComponent(url)];
  if (format) {
    fullURL.push('?' + new URLSearchParams({ format }).toString());
  }
  return fullURL.join('');
}

// when you put a card under edit, we load a new copy in edit mode. This lets us
// look up the original copy from the editable copy.
let originals = new WeakMap();

export default class Cards extends Service {
  async load(url: string, format: Format): Promise<Card> {
    let fullURL = buildURL(url, format);
    return this.internalLoad.perform(fullURL);
  }

  async loadForRoute(pathname: string): Promise<Card> {
    return this.internalLoad.perform(`${cardServer}cardFor${pathname}`);
  }

  // TODO: adjust api to accept Card and not CardModel for symmetry with what we
  // return from our load methods
  async loadForEdit(model: CardModel): Promise<Card> {
    let loaded = await this.internalLoad.perform(buildURL(model.url, 'edit'));
    originals.set(loaded.model, model);
    return loaded;
  }

  @task private internalLoad = taskFor(
    async (url: string): Promise<Card> => {
      let cardResponse = await fetchCard(url);
      let { component, ModelClass } = await loadComponentModule(
        cardResponse,
        url
      );
      let model = new ModelClass(cardResponse);
      let CallerComponent = setComponentTemplate(
        hbs`<this.card @model={{this.model.data}} @set={{this.model.setters}} />`,
        class extends Component {
          model = model;
          card = component;
        }
      );

      return {
        model,
        component: CallerComponent,
      };
    }
  );

  // TODO: adjust api to accept Card and not CardModel for symmetry with what we
  // return from our load methods
  async save(model: CardModel): Promise<void> {
    await this.saveTask.perform(model);
    let original = originals.get(model);
    if (original) {
      // TODO: this should probably be selective and only update fields that
      // already appear in original (which will be a subset of the editable
      // card)
      original.setters(model.data);
    }
  }

  @task saveTask = taskFor(
    async (model: CardModel): Promise<void> => {
      let response = await fetchCard(buildURL(model.url), {
        method: 'PATCH',
        body: JSON.stringify(model.serialize()),
      });
      model.updateFromResponse(response);
    }
  );
}

async function loadComponentModule(
  card: cardJSONReponse,
  url: string
): Promise<{ component: unknown; ModelClass: typeof CardModel }> {
  let componentModuleName = card.data.meta.componentModule;

  // TODO: base this on the componentModuleName prefix instead of isTesting()
  if (macroCondition(isTesting())) {
    // in tests, our fake server inside mirage just defines these modules
    // dynamically
    let cardComponentModule = window.require(componentModuleName);
    return {
      component: cardComponentModule['default'],
      ModelClass: cardComponentModule['Model'],
    };
  } else {
    if (!componentModuleName.startsWith('@cardstack/compiled/')) {
      throw new Error(
        `${url}'s meta.componentModule does not start with '@cardstack/compiled/`
      );
    }
    componentModuleName = componentModuleName.replace(
      '@cardstack/compiled/',
      ''
    );
    let cardComponentModule = await import(
      /* webpackExclude: /schema\.js$/ */
      `@cardstack/compiled/${componentModuleName}`
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

  if (response.status !== 200) {
    throw new Error(`unable to fetch card ${url}: status ${response.status}`);
  }

  return await response.json();
}
