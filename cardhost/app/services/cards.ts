import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import { task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { Format, DeserializerName } from '@cardstack/core/src/interfaces';
import { cardJSONReponse } from '@cardstack/server/src/interfaces';
import { encodeCardURL } from '@cardstack/core/src/utils';
import serializers, { Serializer } from '@cardstack/core/src/serializers';
import config from 'cardhost/config/environment';

const { cardServer } = config as any; // Environment types arent working

export interface LoadedCard {
  model: any;
  component: unknown;
}

export default class Cards extends Service {
  // TODO: Move to modal service
  @tracked isShowingModal = false;
  @tracked modalModel?: LoadedCard;

  async loadInModal(url: string, format: Format): Promise<void> {
    this.isShowingModal = true;

    this.modalModel = await this.load(url, format);
  }

  closeModal(): void {
    this.isShowingModal = false;
    this.modalModel = undefined;
  }

  async load(
    url: string,
    format: Format
  ): Promise<{ model: any; component: unknown }> {
    let params = new URLSearchParams({ format }).toString();
    let fullURL = [cardServer, 'cards/', encodeCardURL(url), `?${params}`];
    return this.internalLoad.perform(fullURL.join(''));
  }

  async loadForRoute(
    pathname: string
  ): Promise<{ model: any; component: unknown }> {
    return this.internalLoad.perform(`${cardServer}cardFor${pathname}`);
  }

  @task
  private internalLoad = taskFor(async function (
    url: string
  ): Promise<LoadedCard> {
    let card = await fetchCard(url);
    let model = await deserializeResponse(card);

    let { componentModule } = card.data.meta;
    let cardComponent: unknown;
    if (macroCondition(isTesting())) {
      // in tests, our fake server inside mirage just defines these modules
      // dynamically
      cardComponent = window.require(componentModule)['default'];
    } else {
      if (!componentModule.startsWith('@cardstack/compiled/')) {
        throw new Error(
          `${url}'s meta.componentModule does not start with '@cardstack/compiled/`
        );
      }
      componentModule = componentModule.replace('@cardstack/compiled/', '');
      cardComponent = (
        await import(
          /* webpackExclude: /schema\.js$/ */
          `@cardstack/compiled/${componentModule}`
        )
      ).default;
    }

    let CallerComponent = setComponentTemplate(
      hbs`<this.card @model = {{this.model}} />`,
      class extends Component {
        card = cardComponent;
        model = model;
      }
    );

    return {
      model,
      component: CallerComponent,
    };
  });
}

async function fetchCard(url: string): Promise<cardJSONReponse> {
  let response = await fetch(url);

  if (response.status !== 200) {
    throw new Error(`unable to fetch card ${url}: status ${response.status}`);
  }

  return await response.json();
}

function deserializeResponse(response: cardJSONReponse): any {
  let { deserializationMap } = response.data.meta;
  let attrs = response.data.attributes;

  if (attrs && deserializationMap) {
    for (const type in deserializationMap) {
      let serializer = serializers[type as DeserializerName];
      let paths = deserializationMap[type as DeserializerName];

      for (const path of paths) {
        deserializeAttribute(attrs, path, serializer);
      }
    }
  }

  let model = Object.assign({ id: response.data.id }, attrs);

  return model;
}

function deserializeAttribute(
  attrs: { [name: string]: any },
  path: string,
  serializer: Serializer
) {
  let [key, ...tail] = path.split('.');
  let value = attrs[key];
  if (!value) {
    throw new MissingDataError(path);
  }

  if (tail.length) {
    let tailPath = tail.join('.');
    if (Array.isArray(value)) {
      for (let row of value) {
        deserializeAttribute(row, tailPath, serializer);
      }
    } else {
      deserializeAttribute(attrs[key], tailPath, serializer);
    }
  } else {
    attrs[path] = serializer.deserialize(value);
  }
}

class MissingDataError extends Error {
  constructor(path: string) {
    super(path);
    this.message = `Server response said ${path} would need to be deserialized, but that path didnt exist`;
  }
}

declare module '@ember/service' {
  interface Registry {
    cards: Cards;
  }
}
