import Koa from 'koa';
import supertest from 'supertest';
import { myOrigin } from '../origin';
import { TestEnv, createTestEnv } from './helpers';
import { testCard } from './test-card';
import { stringify } from 'qs';

describe('hub/jsonapi', function() {
  let request: supertest.SuperTest<supertest.Test>;
  let env: TestEnv;

  beforeEach(async function() {
    env = await createTestEnv();
    let app = new Koa();
    let jsonapi = await env.container.lookup('jsonapi-middleware');
    app.use(jsonapi.middleware());
    request = supertest(app.callback());
  });

  afterEach(async function() {
    await env.destroy();
  });

  it('errors correctly for missing post body', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json');
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property('detail', 'missing resource object');
    expect(response.body.errors[0].source).property('pointer', '/data');
  });

  it('errors correctly for invalid json in post body', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send('{ data ');
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property(
      'detail',
      'error while parsing body: Unexpected token d in JSON at position 2'
    );
  });

  it('errors correctly for local realm on remote-realms endpoint', async function() {
    let response = await request
      .post(`/api/remote-realms/${encodeURIComponent(myOrigin + '/api/realms/first-ephemeral-realm')}/cards`)
      .set('Content-Type', 'application/vnd.api+json')
      .send({
        data: {
          type: 'cards',
        },
      });
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0].detail).matches(/is a local realm. You tried to access it/);
  });

  it('can create card', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().jsonapi);
    expect(response.status).to.equal(201);
    expect(response.header.location).to.match(/http:\/\/[^/]+\/api\/realms\/first-ephemeral-realm\/cards\/[^/]+/);
  });

  it('can patch a card', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ foo: 'bar', hello: 'world' }).jsonapi);
    let cardDoc = response.body;
    let csId = cardDoc.data.attributes.csId;
    cardDoc.data.attributes.foo = 'poo';
    delete cardDoc.data.attributes.hello;

    response = await request
      .patch(`/api/realms/first-ephemeral-realm/cards/${csId}`)
      .set('Content-Type', 'application/vnd.api+json')
      .send(cardDoc);
    expect(response.status).to.equal(200);
    expect(response.body.data.attributes.foo).to.equal('poo');
    expect(response.body.data.attributes.hello).to.equal('world');
  });

  it('errors correctly for missing patch body', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ foo: 'bar', hello: 'world' }).jsonapi);
    let csId = response.body.data.attributes.csId;

    response = await request
      .patch(`/api/realms/first-ephemeral-realm/cards/${csId}`)
      .set('Content-Type', 'application/vnd.api+json');
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property('detail', 'missing resource object');
    expect(response.body.errors[0].source).property('pointer', '/data');
  });

  it('errors correctly for invalid json in patch body', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ foo: 'bar', hello: 'world' }).jsonapi);
    let csId = response.body.data.attributes.csId;

    response = await request
      .patch(`/api/realms/first-ephemeral-realm/cards/${csId}`)
      .set('Content-Type', 'application/vnd.api+json')
      .send('{ data ');
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property(
      'detail',
      'error while parsing body: Unexpected token d in JSON at position 2'
    );
  });

  it('can delete a card', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().jsonapi);
    let csId = response.body.data.attributes.csId;
    let version = response.body.data.meta.version;

    response = await request
      .delete(`/api/realms/first-ephemeral-realm/cards/${csId}`)
      .set('Content-Type', 'application/vnd.api+json')
      .set('If-Match', version);

    expect(response.status).to.equal(204);

    response = await request
      .get(`/api/realms/first-ephemeral-realm/cards/${csId}`)
      .set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(404);
  });

  it('handles missing card in valid realm', async function() {
    let response = await request
      .get('/api/realms/first-ephemeral-realm/cards/not-a-real-card')
      .set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(404);
  });

  it('can get a card from local realm that was created in that realm', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ hello: 'world' }).jsonapi);
    expect(response.status).to.equal(201);

    response = await request.get(new URL(response.header.location).pathname).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data?.attributes?.hello).to.equal('world');
    expect(response.body?.data?.attributes?.csRealm).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);
  });

  it('can get a card from local realm that was created in another realm', async function() {
    let response = await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(
        testCard().withAttributes({ csOriginalRealm: 'https://somewhere/else', csId: '432', hello: 'world' }).jsonapi
      );
    expect(response.status).to.equal(201);

    response = await request.get(new URL(response.header.location).pathname).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data?.attributes?.hello).to.equal('world');
    expect(response.body?.data?.attributes?.csOriginalRealm).to.equal('https://somewhere/else');
    expect(response.body?.data?.attributes?.csRealm).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);
  });

  it('can get a card from remote realm that was created in that realm', async function() {
    let response = await request
      .post(`/api/remote-realms/${encodeURIComponent('http://example.com/api/realms/second-ephemeral-realm')}/cards`)
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ hello: 'world' }).jsonapi);
    expect(response.status).to.equal(201);

    response = await request.get(new URL(response.header.location).pathname).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data?.attributes?.hello).to.equal('world');
    expect(response.body?.data?.attributes?.csRealm).to.equal('http://example.com/api/realms/second-ephemeral-realm');
  });

  it('can get a card from remote realm that was created in another realm', async function() {
    let response = await request
      .post(`/api/remote-realms/${encodeURIComponent('http://example.com/api/realms/second-ephemeral-realm')}/cards`)
      .set('Content-Type', 'application/vnd.api+json')
      .send(
        testCard().withAttributes({ csOriginalRealm: 'https://somewhere/else', csId: '432', hello: 'world' }).jsonapi
      );
    expect(response.status).to.equal(201);

    response = await request.get(new URL(response.header.location).pathname).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data?.attributes?.hello).to.equal('world');
    expect(response.body?.data?.attributes?.csOriginalRealm).to.equal('https://somewhere/else');
    expect(response.body?.data?.attributes?.csRealm).to.equal('http://example.com/api/realms/second-ephemeral-realm');
  });

  it('can search for cards', async function() {
    await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().jsonapi);
    await request
      .post('/api/realms/first-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ foo: 'bar' }).jsonapi);
    await request
      .post('/api/realms/second-ephemeral-realm/cards')
      .set('Content-Type', 'application/vnd.api+json')
      .send(testCard().withAttributes({ foo: 'bar' }).jsonapi);

    let filter = {
      filter: {
        eq: { csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm` },
      },
    };
    let response = await request.get(`/api/cards?${stringify(filter)}`).set('Accept', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body?.data.length).to.equal(2);
  });

  it('can paginate the search results', async function() {
    for (let i = 0; i < 20; i++) {
      await request
        .post('/api/realms/first-ephemeral-realm/cards')
        .set('Content-Type', 'application/vnd.api+json')
        .send(testCard().withAttributes({ foo: 'bar' }).jsonapi);
    }

    let filter = {
      filter: {
        eq: { csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm` },
      },
      page: {
        size: 7,
        cursor: undefined,
      },
    };

    let response = await request.get(`/api/cards?${stringify(filter)}`).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data.length).to.equal(7);
    expect(response.body?.meta.page.total).to.equal(20);
    expect(response.body?.meta.page.cursor).to.be.ok;

    filter.page.cursor = response.body.meta.page.cursor;
    response = await request.get(`/api/cards?${stringify(filter)}`).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data.length).to.equal(7);
    expect(response.body?.meta.page.total).to.equal(20);
    expect(response.body?.meta.page.cursor).to.be.ok;

    filter.page.cursor = response.body.meta.page.cursor;
    response = await request.get(`/api/cards?${stringify(filter)}`).set('Accept', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body?.data.length).to.equal(6);
    expect(response.body?.meta.page.total).to.equal(20);
    expect(response.body?.meta.page.cursor).to.be.not.ok;
  });

  it('returns 400 when search query is malformed', async function() {
    let filter = {
      filter: { foo: 'bar' },
    };
    let response = await request.get(`/api/cards?${stringify(filter)}`).set('Accept', 'application/vnd.api+json');

    expect(response.status).to.equal(400);
  });
});
