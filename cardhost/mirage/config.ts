import { Server } from 'miragejs/server';
import { Compiler } from '@cardstack/core';

export default function (this: Server): void {
  // These comments are here to help you get started. Feel free to delete them.

  /*
    Config (with defaults).

    Note: these only affect routes defined *after* them!
  */

  // this.urlPrefix = 'http://mirage'; // make this `http://localhost:8080`, for example, if your API is on a different server
  this.namespace = ''; // make this `/api`, for example, if your API is namespaced
  // this.timing = 400;      // delay for each request, automatically set to 0 during testing

  this.get('http://mirage/cards/:id', async function (schema, request) {
    let { id } = request.params;
    let rawCard = schema.cards.find(`http://mirage/cards/${id}`);
    let compiler = new Compiler();
    let compiledCard = await compiler.compile(rawCard.attrs.raw);
    return compiledCard;
  });

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
