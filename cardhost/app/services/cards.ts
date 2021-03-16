import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';

export default class Cards extends Service {
  async load(
    url: string,
    format: 'isolated' | 'embedded'
  ): Promise<{ model: any; component: unknown }> {
    return this.internalLoad(`${url}?format=${format}`);
  }

  async loadForRoute(
    pathname: string
  ): Promise<{ model: any; component: unknown }> {
    return this.internalLoad(`/spaces/home/${pathname}`);
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

    let cardComponent: unknown;
    if (macroCondition(isTesting())) {
      // in tests, our fake server inside mirage just defines these modules
      // dynamically
      cardComponent = window.require(
        `@cardstack/compiled/${card.data.meta.componentModule}`
      );
    } else {
      cardComponent = await import(
        `@cardstack/compiled/${card.data.meta.componentModule}`
      );
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
