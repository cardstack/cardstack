import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';

import { Format, Deserializer } from '@cardstack/core/src/interfaces';
import { cardJSONReponse } from '@cardstack/server/src/interfaces';
import { encodeCardURL } from '@cardstack/core/src/utils';
import serializers from '@cardstack/core/src/serializers';

import config from 'cardhost/config/environment';
const { cardServer } = config as any; // Environment types arent working

export default class Cards extends Service {
  async load(
    url: string,
    format: Format
  ): Promise<{ model: any; component: unknown }> {
    let params = new URLSearchParams({ format }).toString();
    let fullURL = [cardServer, 'cards/', encodeCardURL(url), `?${params}`];
    return this.internalLoad(fullURL.join(''));
  }

  async loadForRoute(
    pathname: string
  ): Promise<{ model: any; component: unknown }> {
    return this.internalLoad(`${cardServer}cardFor${pathname}`);
  }

  private async internalLoad(
    url: string
  ): Promise<{ model: any; component: unknown }> {
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
  }
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
      let serializer = serializers[type as Deserializer];
      let paths = deserializationMap[type as Deserializer];
      for (const path of paths) {
        if (!attrs[path]) {
          throw Error(
            `Server response said ${path} would need to be deserialized, but that path didnt exist`
          );
        }
        attrs[path] = serializer.deserialize(attrs[path]);
      }
    }
  }

  let model = Object.assign({ id: response.data.id }, attrs);

  return model;
}

declare module '@ember/service' {
  interface Registry {
    cards: Cards;
  }
}
