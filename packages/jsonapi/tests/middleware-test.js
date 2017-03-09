const jsonapi = require('@cardstack/jsonapi/middleware');
const supertest = require('supertest');
const Koa = require('koa');
const addRecords = require('@cardstack/server/tests/add-records');

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
    app.use(jsonapi());
    request = supertest(app.callback());
  }),

  it('can get a single resource', async function() {
    let response = await request.get('/articles/0');
    expect(response).to.have.property('status', 200);
    expect(response.body).deep.property('data.id', '0');
    expect(response.body).deep.property('data.attributes.title', 'Hello world');
  });

});
