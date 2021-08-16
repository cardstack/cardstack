import Service from '@ember/service';
import { macroCondition, isTesting } from '@embroider/macros';
import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import {
  Format,
  CardJSONResponse,
  CardEnv,
  CardOperation,
} from '@cardstack/core/src/interfaces';
import CardModel from '@cardstack/core/src/card-model';
import type { NewCardParams } from '@cardstack/core/src/card-model';
import config from 'cardhost/config/environment';

// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { tracked } from '@glimmer/tracking';

const { cardServer } = config as any; // Environment types arent working

// the methods our service makes available for CardModel's exclusive use
export default class Cards extends Service {
  async load(url: string, format: Format): Promise<CardModel> {
    let fullURL = this.buildCardURL(url, format);
    let loaded = await taskFor(this.internalLoad).perform(fullURL);
    return loaded.ModelClass.fromResponse(
      this.cardEnv(),
      loaded.cardResponse,
      loaded.component
    );
  }

  async loadForRoute(pathname: string): Promise<CardModel> {
    let loaded = await taskFor(this.internalLoad).perform(
      `${cardServer}cardFor${pathname}`
    );
    return loaded.ModelClass.fromResponse(
      this.cardEnv(),
      loaded.cardResponse,
      loaded.component
    );
  }

  async createNew(params: NewCardParams): Promise<CardModel> {
    let parent = await this.load(params.parentCardURL, 'edit');
    return parent.adoptIntoRealm(params.realm);
  }

  @task private async internalLoad(url: string) {
    let cardResponse = await this.fetchJSON(url);
    let { component, ModelClass } = await loadCode(cardResponse, url);
    return { cardResponse, component, ModelClass };
  }

  private cardEnv(): CardEnv {
    return {
      load: this.load.bind(this),
      send: this.send.bind(this),
      prepareComponent: this.prepareComponent.bind(this),
      tracked: tracked as unknown as CardEnv['tracked'], // ¯\_(ツ)_/¯
    };
  }

  private async send(op: CardOperation): Promise<CardJSONResponse> {
    if ('create' in op) {
      return await this.fetchJSON(
        this.buildNewURL(op.create.targetRealm, op.create.parentCardURL),
        {
          method: 'POST',
          body: JSON.stringify(op.create.payload),
        }
      );
    } else if ('update' in op) {
      return await this.fetchJSON(this.buildCardURL(op.update.cardURL), {
        method: 'PATCH',
        body: JSON.stringify(op.update.payload),
      });
    } else {
      throw new Error(`unsupported card operation ${JSON.stringify(op)}`);
    }
  }

  private buildNewURL(realm: string, parentCardURL: string): string {
    return [
      cardServer,
      'cards/',
      encodeURIComponent(realm) + '/',
      encodeURIComponent(parentCardURL),
    ].join('');
  }

  private buildCardURL(url: string, format?: Format): string {
    let fullURL = [cardServer, 'cards/', encodeURIComponent(url)];
    if (format) {
      fullURL.push('?' + new URLSearchParams({ format }).toString());
    }
    return fullURL.join('');
  }

  private async fetchJSON(
    url: string,
    options: any = {}
  ): Promise<CardJSONResponse> {
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

  private prepareComponent(cardModel: CardModel, component: unknown): unknown {
    return setComponentTemplate(
      hbs`<this.component @model={{this.data}} @set={{this.set}} />`,
      class extends Component {
        component = component;
        get data() {
          return cardModel.data;
        }
        set = cardModel.setters;
      }
    );
  }
}

async function loadCode(
  card: CardJSONResponse,
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
