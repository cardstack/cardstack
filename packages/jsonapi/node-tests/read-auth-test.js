const jsonapi = require('@cardstack/jsonapi/middleware');
const supertest = require('supertest');
const Koa = require('koa');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/server/node-tests/support');

describe('auth/read', function() {
  let request, env;

  beforeEach(async function() {
    env = await createDefaultEnvironment([
      {
        type: 'content-types',
        id: 'articles',
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' },
              { type: 'fields', id: 'body' }
            ]
          },
          'data-source': {
            data: { type: 'data-sources', id: 'default-git' }
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
        },
        relationships: {
          constraints: {
            data: [ { type: 'constraints', id: '0'} ]
          }
        }
      },
      {
        type: 'constraints',
        id: '0',
        attributes: {
          'constraint-type': '@cardstack/core-types::not-null'
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
    app.use(jsonapi(env.searcher, env.writers));
    request = supertest(app.callback());
  }),

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  }),

  it.skip('protects individual resource from anonymous request', async function() {
    let response = await request.get('/articles/0');
    expect(response).hasStatus(401);
  });

  it.skip('filters resources from collection for anonymous request', async function() {
    let response = await request.get('/articles');
    expect(response).hasStatus(200);
    expect(response.body.data).length(0);
  });
});
