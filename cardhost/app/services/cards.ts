import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { Format, cardJSONReponse } from '@cardstack/core/src/interfaces';
import type ComponentModel from '@cardstack/core/src/base-component-model';
import config from 'cardhost/config/environment';

const { cardServer } = config as any; // Environment types arent working

export interface LoadedCard {
  model: ComponentModel;
  component: unknown;
}

function buildURL(url: string, format?: Format): string {
  let fullURL = [cardServer, 'cards/', encodeURIComponent(url)];
  if (format) {
    fullURL.push('?' + new URLSearchParams({ format }).toString());
  }
  return fullURL.join('');
}

export default class Cards extends Service {
  async load(url: string, format: Format): Promise<LoadedCard> {
    let fullURL = buildURL(url, format);
    return this.internalLoad.perform(fullURL);
  }

  async loadForRoute(pathname: string): Promise<LoadedCard> {
    return this.internalLoad.perform(`${cardServer}cardFor${pathname}`);
  }

  @task private internalLoad = taskFor(
    async (url: string): Promise<LoadedCard> => {
      let cardResponse = await fetchCard(url);
      let { component, model } = await loadComponentModule(cardResponse, url);

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

  async save(cardURL: string, model: ComponentModel): Promise<ComponentModel> {
    return this.saveTask.perform(cardURL, model);
  }

  @task saveTask = taskFor(
    async (cardURL: string, model: ComponentModel): Promise<ComponentModel> => {
      let response = await fetchCard(buildURL(cardURL), {
        method: 'PATCH',
        body: JSON.stringify(model.serialize()),
      });
      model.updateFromResponse(response);
      return model;
    }
  );
}

async function loadComponentModule(
  card: cardJSONReponse,
  url: string
): Promise<{ component: unknown; model: ComponentModel }> {
  let componentModuleName = card.data.meta.componentModule;
  let component: unknown;
  let ModelClass: typeof ComponentModel;

  if (macroCondition(isTesting())) {
    // in tests, our fake server inside mirage just defines these modules
    // dynamically
    let cardComponentModule = window.require(componentModuleName);
    component = cardComponentModule['default'];
    ModelClass = cardComponentModule['Model'];
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

    component = cardComponentModule.default;
    ModelClass = cardComponentModule.Model;
  }

  return {
    component,
    model: new ModelClass(card),
  };
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
