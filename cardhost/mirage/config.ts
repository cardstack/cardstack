import { Response, Request } from 'miragejs';
import type { Server } from 'miragejs/server';

import Builder from 'cardhost/lib/builder';
import { RawCard } from '@cardstack/core/src/interfaces';
import { compileTemplate } from 'cardhost/tests/helpers/template-compiler';
import templateOnlyComponent from '@ember/component/template-only';
import { setComponentTemplate } from '@ember/component';

export default function (this: Server): void {
  function returnRawCard(schema: any, url: string): RawCard | Response {
    let rawCard = schema.cards.find(url);
    if (!rawCard) {
      return new Response(404, {}, { error: `Not Found: No card for '${url}` });
    }
    return rawCard;
  }

  interface CardParams {
    format?: 'isolated' | 'embedded';
    type?: 'raw' | 'compiled';
  }

  function cardParams(queryParams: Request['queryParams']): CardParams {
    let { type, format } = queryParams;
    if (type && !['raw', 'compiled'].includes(type)) {
      throw new Error(`unsupported ?type=${type}`);
    }
    if (format && !['isolated', 'embedded'].includes(format)) {
      throw new Error(`unsupported ?format=${format}`);
    }
    return queryParams;
  }

  async function returnCompiledCard(schema: any, request: Request) {
    let { format, type } = cardParams(request.queryParams);
    let [url] = request.url.split('?');
    if (type == 'raw') {
      return returnRawCard(schema, url);
    }

    let builder = new Builder();
    let compiledCard = await builder.getCompiledCard(url);

    if (!format) {
      throw new Error(`format is required at the moment`);
    }

    let templateSource = compiledCard.templateSources[format];
    let moduleId = `mirage/module${moduleCounter++}`;

    (window as any).define(`@cardstack/compiled/${moduleId}`, function () {
      return setComponentTemplate(
        compileTemplate(templateSource),
        templateOnlyComponent()
      );
    });

    return {
      data: {
        id: url,
        attributes: compiledCard.data,
        meta: {
          componentModule: moduleId,
        },
      },
    };
  }

  this.get('http://mirage/cards/:id', returnCompiledCard);
  this.get('http://cardstack.com/base/models/:id', returnCompiledCard);

  /*
    Shorthand cheatsheet:

    this.get('/posts');
    this.post('/posts');
    this.get('/posts/:id');
    this.put('/posts/:id'); // or this.patch
    this.del('/posts/:id');

    https://www.ember-cli-mirage.com/docs/route-handlers/shorthands
  */
}

let moduleCounter = 0;
