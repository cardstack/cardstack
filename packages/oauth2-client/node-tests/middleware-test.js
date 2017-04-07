const oauth2Client = require('@cardstack/oauth2-client/middleware');
const supertest = require('supertest');
const Koa = require('koa');

describe('oauth2-client', function() {

  let request;

  beforeEach(async function() {
    let app = new Koa();
    app.use(oauth2Client());
    request = supertest(app.callback());
  }),

  afterEach(async function() {
  }),

  it('can get an individual resource', async function() {
    let response = await request.post('/').send({
      data: {
        type: 'bogus',
        attributes: {
          title: 'I am new'
        }
      }
    });
    expect(response).hasStatus(200);
    expect(response.body).deep.property('data.id', '0');
    expect(response.body).deep.property('data.attributes.title', 'Hello world');
    expect(response.body).not.deep.property('data.relationships');
  });


});
