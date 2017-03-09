const jsonapi = require('@cardstack/jsonapi/middleware');
const supertest = require('supertest');
const Koa = require('koa');
const { addRecords, deleteAllRecords } = require('@cardstack/server/tests/add-records');
const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');

describe('jsonapi', function() {

  let request;

  beforeEach(async function() {
    await addRecords([
      {
        type: 'content-types',
        id: 'articles',
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' },
              { type: 'fields', id: 'body' }
            ]
          }
        }
      },
      {
        type: 'fields',
        id: 'title',
        attributes: {
          'field-type': 'string'
        }
      },
      {
        type: 'fields',
        id: 'body',
        attributes: {
          'field-type': 'string'
        }
      },
      {
        type: 'articles',
        id: '0',
        attributes: {
          title: "Hello world",
          body: "This is the first article"
        }
      },
      {
        type: 'articles',
        id: '1',
        attributes: {
          title: "Second",
          body: "This is the second article"
        }
      },
      {
        type: 'comments',
        id: '0',
        attributes: {
          body: 'This is a comment'
        }
      }
    ]);
    let app = new Koa();
    let searcher = new Searcher(new SchemaCache());
    app.use(jsonapi(searcher));
    request = supertest(app.callback());
  }),

  afterEach(async function() {
    await deleteAllRecords();
  }),

  it('can get an individual resource', async function() {
    let response = await request.get('/articles/0');
    expect(response).to.have.property('status', 200);
    expect(response.body).deep.property('data.id', '0');
    expect(response.body).deep.property('data.attributes.title', 'Hello world');
  });

  it('returns 404 for missing individual resource', async function() {
    let response = await request.get('/articles/98766');
    expect(response).to.have.property('status', 404);
    expect(response.body).to.have.deep.property('errors[0].detail', 'No such resource /articles/98766');
  });

  it('can get a collection resource', async function() {
    let response = await request.get('/articles');
    expect(response).to.have.property('status', 200);
    expect(response.body).to.have.property('data');
    expect(response.body).to.have.deep.property('meta.total', 2);
    expect(response.body.data).length(2);
    expect(response.body.data).collectionContains({ type: 'articles', id: '0' });
    expect(response.body.data).collectionContains({ type: 'articles', id: '1' });
  });

  it('can sort a collection resource', async function() {
    let response = await request.get('/articles?sort=title');
    expect(response).to.have.property('status', 200);
    expect(response.body).to.have.property('data');
    expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
    expect(response.body).has.deep.property('data[1].attributes.title', 'Second');
  });

  it('can reverse sort a collection resource', async function() {
    let response = await request.get('/articles?sort=-title');
    expect(response).has.property('status', 200);
    expect(response.body).has.property('data');
    expect(response.body).has.deep.property('data[1].attributes.title', 'Hello world');
    expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
  });

  it('can filter a collection resource', async function() {
    let response = await request.get('/articles?filter[title]=world');
    expect(response).has.property('status', 200);
    expect(response.body).has.property('data');
    expect(response.body.data).length(1);
    expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
  });

  it('can paginate a collection resource', async function() {
    let response = await request.get('/articles?page[size]=1&sort=title');
    expect(response).has.property('status', 200, 'first request');
    expect(response.body.data).length(1);
    expect(response.body).has.deep.property('data[0].attributes.title', 'Hello world');
    expect(response.body).has.deep.property('links.next');

    response = await request.get(response.body.links.next);
    expect(response).has.property('status', 200, 'second request');
    expect(response.body).has.deep.property('data[0].attributes.title', 'Second');
    expect(response.body.data).length(1);
  });

});
