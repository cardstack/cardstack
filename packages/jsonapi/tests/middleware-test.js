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
        type: 'articles',
        id: '0',
        attributes: {
          title: "Hello world"
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

  it('can get a single resource', async function() {
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

});
