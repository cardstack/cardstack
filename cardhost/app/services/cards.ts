import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';

import { Format } from '@cardstack/core/src/interfaces';

import config from 'cardhost/config/environment';
const { cardServer } = config as any; // Environment types arent working

export default class Cards extends Service {
  async load(
    url: string,
    format: Format
  ): Promise<{ model: any; component: unknown }> {
    let params = new URLSearchParams({ format }).toString();
    let fullURL = [cardServer, 'cards/', encodeURIComponent(url), `?${params}`];
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
    let response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`unable to fetch card ${url}: status ${response.status}`);
    }

    let card = (await response.json()) as {
      data: {
        id: string;
        type: string;
        attributes?: { [name: string]: any };
        meta: {
          componentModule: string;
        };
      };
    };

    let model = Object.assign({ id: card.data.id }, card.data.attributes);

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

declare module '@ember/service' {
  interface Registry {
    cards: Cards;
  }
}
