const jsonapi = require('@cardstack/server/jsonapi');
const supertest = require('supertest');
const Koa = require('koa');

describe('jsonapi', function() {

  let request;

  beforeEach(async function() {
    let app = new Koa();
    app.use(jsonapi());
    request = supertest(app.callback());
  }),

  it('can access the built-in fields', async function() {
    let response = await request.get('/fields');
    expect(response).to.have.property('status', 200);
    expect(response).deep.property('body.data').includes.something.with.deep.property('attributes.name', 'string');
  });

});
