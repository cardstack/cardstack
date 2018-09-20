const supertest = require('supertest');
const Koa = require('koa');
const nock = require('nock');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  validAccessToken,
  githubUser,
  githubUsersResponse
} = require('./fixtures/github-responses');

describe('github-auth/authenticator', function() {
  let request, env;
  let ciSessionId = '1234567890';

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('grants')
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withAttributes({
        mayLogin: true
      });

    factory.addResource('data-sources', 'github').withAttributes({
      sourceType: '@cardstack/github-auth',
      params: {
        'client-id': 'mock-github-client-id',
        'client-secret': 'mock-github-client-secret',
        token: 'mock-github-token'
      }
    });

    env = await createDefaultEnvironment(`${__dirname}/github-authenticator`, factory.getModels(), { ciSessionId });
    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  beforeEach(setup);
  afterEach(teardown);

  it('returns token for an authenticated github session', async function() {
    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(200, validAccessToken);

    nock('https://api.github.com')
      .get('/user')
      .reply(function() {
        return [ 200, githubUser, {
          'cache-control': 'private, max-age=60, s-maxage=60'
        }];
      });

    nock('https://api.github.com')
      .get('/users/habdelra')
      .reply(function() {
        return [ 200, githubUsersResponse, {
          'cache-control': 'private, max-age=60, s-maxage=60'
        }];
      });

    let response = await request.post('/auth/github').send({ authorizationCode: 'authToken' });

    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.type', 'github-users');
    expect(response.body).has.deep.property('data.id', 'habdelra');
    expect(response.body).has.deep.property('data.meta.source', 'github');
    expect(response.body.data.meta.token).is.ok;
    expect(response.body.data.meta.validUntil).is.ok;
  });
});
