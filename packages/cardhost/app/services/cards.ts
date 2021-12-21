import Service from '@ember/service';

import {
  Format,
  CardEnv,
  CardOperation,
  JSONAPIDocument,
} from '@cardstack/core/src/interfaces';
import CardModel from '@cardstack/core/src/card-model';
import config from 'cardhost/config/environment';

// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { tracked } from '@glimmer/tracking';
import type Builder from 'cardhost/lib/builder';
import { fetchJSON } from 'cardhost/lib/jsonapi-fetch';
import { LOCAL_REALM } from 'cardhost/lib/builder';

const { cardServer } = config as any; // Environment types arent working

export default class Cards extends Service {
  private localRealmURL = LOCAL_REALM;
  overrideRoutingCardWith: string | undefined;

  async load(url: string, format: Format): Promise<CardModel> {
    let cardResponse: JSONAPIDocument;
    if (this.inLocalRealm(url)) {
      let builder = await this.builder();
      cardResponse = await builder.load(url, format);
    } else {
      cardResponse = await fetchJSON<JSONAPIDocument>(
        this.buildCardURL(url, format)
      );
    }
    let { component, Model } = await this.codeForCard(cardResponse);
    return Model.fromResponse(this.cardEnv(), cardResponse, component);
  }

  async loadForRoute(pathname: string): Promise<CardModel> {
    if (this.overrideRoutingCardWith) {
      let builder = await this.builder();
      return await builder.loadForRoute(this.overrideRoutingCardWith, pathname);
    } else {
      let url = `${cardServer}cardFor${pathname}`;
      let cardResponse = await fetchJSON<JSONAPIDocument>(url);
      let { component, Model } = await this.codeForCard(cardResponse);
      return Model.fromResponse(this.cardEnv(), cardResponse, component);
    }
  }

  private inLocalRealm(cardURL: string): boolean {
    return cardURL.startsWith(this.localRealmURL);
  }

  private cardEnv(): CardEnv {
    return {
      load: this.load.bind(this),
      send: this.send.bind(this),
      prepareComponent: this.prepareComponent.bind(this),
      tracked: tracked as unknown as CardEnv['tracked'], // ¯\_(ツ)_/¯
    };
  }

  private _builderPromise: Promise<Builder> | undefined;

  async builder(): Promise<Builder> {
    if (this._builderPromise) {
      return this._builderPromise;
    }
    let resolve: any, reject: any;
    this._builderPromise = new Promise((r, e) => {
      resolve = r;
      reject = e;
    });
    try {
      let { default: Builder } = await import('../lib/builder');
      let builder = new Builder(this.localRealmURL, this);
      resolve(builder);
      return builder;
    } catch (err) {
      reject(err);
      throw err;
    }
  }

  private async send(op: CardOperation): Promise<JSONAPIDocument> {
    if (this.operationIsLocal(op)) {
      let builder = await this.builder();
      return await builder.send(op);
    }

    if ('create' in op) {
      return await fetchJSON<JSONAPIDocument>(
        this.buildNewURL(op.create.targetRealm, op.create.parentCardURL),
        {
          method: 'POST',
          body: JSON.stringify(op.create.payload),
        }
      );
    } else if ('update' in op) {
      return await fetchJSON<JSONAPIDocument>(
        this.buildCardURL(op.update.cardURL),
        {
          method: 'PATCH',
          body: JSON.stringify(op.update.payload),
        }
      );
    } else {
      throw assertNever(op);
    }
  }

  private operationIsLocal(op: CardOperation): boolean {
    if ('create' in op) {
      return this.inLocalRealm(op.create.targetRealm);
    } else if ('update' in op) {
      return this.inLocalRealm(op.update.cardURL);
    } else {
      throw assertNever(op);
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

  private async codeForCard(
    card: JSONAPIDocument
  ): Promise<{ component: unknown; Model: typeof CardModel }> {
    let componentModule = card.data?.meta?.componentModule;
    if (!componentModule) {
      throw new Error('No componentModule to load');
    }
    if (typeof componentModule !== 'string') {
      throw new Error('Cards component module is not a string');
    }
    let module = await this.loadModule<{
      default: unknown;
      Model: typeof CardModel;
    }>(componentModule);
    return {
      component: module.default,
      Model: module.Model,
    };
  }

  async loadModule<T extends object>(moduleIdentifier: string): Promise<T> {
    if (moduleIdentifier.startsWith('@cardstack/compiled/')) {
      // module was built by webpack, use webpack's implementation of `await
      // import()`
      moduleIdentifier = moduleIdentifier.replace('@cardstack/compiled/', '');
      return await import(
        /* webpackExclude: /schema\.js$/ */
        `@cardstack/compiled/${moduleIdentifier}`
      );
    } else if (moduleIdentifier.startsWith('@cardstack/core/src/')) {
      // module was built by webpack, use webpack's implementation of `await
      // import()`
      moduleIdentifier = moduleIdentifier.replace('@cardstack/core/src/', '');

      // the webpackInclude is necessary because sometimes @cardstack/core has
      // already been pre-built (for consumption in node) and has .js, .d.ts,
      // and .js.map files on disk, all of which would potentially match this
      // wildcard import. We want the .ts only, because that is what embroider
      // with ember-cli-typescript prioritizes in every other import from core.
      return await import(
        /* webpackInclude: /(?<!\.d)\.ts$/ */
        `@cardstack/core/src/${moduleIdentifier}`
      );
    } else if (moduleIdentifier.startsWith('@cardstack/boxel/')) {
      // module was built by webpack, use webpack's implementation of `await
      // import()`
      moduleIdentifier = moduleIdentifier.replace('@cardstack/boxel/', '');
      return await import(
        /* webpackInclude: /\.(js|hbs)$/ */
        `@cardstack/boxel/${moduleIdentifier}`
      );
    } else if (
      moduleIdentifier.startsWith('@cardstack/local-realm-compiled/')
    ) {
      // module was built by our Builder, so ask Builder for it
      let builder = await this.builder();
      return await builder.loadModule<T>(moduleIdentifier);
    } else {
      throw new Error(
        `don't know how to load compiled card code for ${moduleIdentifier}`
      );
    }
  }
}

function assertNever(value: never) {
  throw new Error(`unsupported operation ${value}`);
}
