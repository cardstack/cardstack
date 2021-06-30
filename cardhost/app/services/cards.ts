import Service from '@ember/service';
import { set } from '@ember/object';
import { macroCondition, isTesting } from '@embroider/macros';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { Format, DeserializerName } from '@cardstack/core/src/interfaces';
import { cardJSONReponse } from '@cardstack/server/src/interfaces';
import serializers, {
  PrimitiveSerializer,
} from '@cardstack/core/src/serializers';
import config from 'cardhost/config/environment';

interface CardJSONAPIRequest {
  data: {
    type: 'card';
    id: any;
    attributes: any;
  };
}

type Setter = (value: any) => void;

const { cardServer } = config as any; // Environment types arent working

export interface LoadedCard {
  data: any;
  component: unknown;
  setters: Setter;
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
      let card = await fetchCard(url);
      let data = await deserializeResponse(card);

      let setters = makeSetter((segments, value) => {
        set(data, segments.join('.'), value);
      });

      let cardComponent = await loadComponentModule(
        card.data.meta.componentModule,
        url
      );

      // TODO: @set should be conditional?
      let CallerComponent = setComponentTemplate(
        hbs`<this.card @model={{this.model}} @set={{this.setters}} />`,
        class extends Component {
          model = data;
          card = cardComponent;
          setters = setters;
        }
      );

      return {
        data,
        component: CallerComponent,
        setters,
      };
    }
  );

  async save(cardURL: string, data: unknown): Promise<void> {
    return this.saveTask.perform(cardURL, data);
  }

  @task saveTask = taskFor(
    async (cardURL: string, data: any): Promise<void> => {
      let response = await fetchCard(buildURL(cardURL), {
        method: 'PATCH',
        body: JSON.stringify(serializeCard(data)),
      });
      let model = await deserializeResponse(response);
      return model;
    }
  );
}

async function loadComponentModule(
  componentModule: string,
  url: string
): Promise<unknown> {
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
  return cardComponent;
}

function makeSetter(
  callback: (segments: string[], value: any) => void,
  segments: string[] = []
): Setter {
  let s = (value: any) => {
    callback(segments, value);
  };
  (s as any).setters = new Proxy(
    {},
    {
      get: (target: object, prop: string, receiver: unknown) => {
        if (typeof prop === 'string') {
          return makeSetter(callback, [...segments, prop]);
        } else {
          return Reflect.get(target, prop, receiver);
        }
      },
    }
  );

  return s;
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

// Eventual TODO: Full serialization?
function serializeCard(attrs: Record<string, any>): CardJSONAPIRequest {
  let id = attrs.id;
  delete attrs.id;

  // TODO: Once we remember the serializerMap, serialize
  return {
    data: {
      type: 'card',
      id,
      attributes: attrs,
    },
  };
}

function deserializeResponse(response: cardJSONReponse): any {
  // TODO: We need to keep this around
  let { serializerMap } = response.data.meta;
  let attrs = response.data.attributes;

  if (attrs && serializerMap) {
    for (const type in serializerMap) {
      let serializer = serializers[type as DeserializerName];
      let paths = serializerMap[type as DeserializerName];

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
  serializer: PrimitiveSerializer
) {
  let [key, ...tail] = path.split('.');
  let value = attrs[key];
  if (!value) {
    return;
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
