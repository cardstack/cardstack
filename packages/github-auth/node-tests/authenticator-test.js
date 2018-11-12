const supertest = require('supertest');
const Koa = require('koa');
const nock = require('nock');
const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  validAccessToken,
  githubUser,
  githubUsersResponse,
  githubReadPermissions,
} = require('./fixtures/github-responses');

describe('github-auth/authenticator', function() {
  let request, env;
  let ciSessionId = '1234567890';

  async function setup() {
    let factory = new JSONAPIFactory();

    factory
      .addResource('grants')
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withAttributes({
        mayLogin: true,
      });

    factory
      .addResource('grants')
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [{ type: 'content-types', id: 'github-users' }])
      .withAttributes({
        'may-read-resource': true,
        'may-read-fields': true,
      });

    factory.addResource('data-sources', 'github').withAttributes({
      sourceType: '@cardstack/github-auth',
      params: {
        'client-id': 'mock-github-client-id',
        'client-secret': 'mock-github-client-secret',
        token: 'mock-github-token',
        permissions: [{ repo: 'cardstack/repo1', permission: 'read' }],
      },
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

  it('returns github-users document for an authenticated github session', async function() {
    let { login: id } = githubUser;

    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(200, validAccessToken);

    nock('https://api.github.com')
      .get('/user')
      .reply(200, githubUser);

    nock('https://api.github.com')
      .get(`/users/${id}`)
      .reply(200, githubUsersResponse);

    nock('https://api.github.com')
      .get(`/repos/cardstack/repo1/collaborators/${id}/permission`)
      .reply(200, githubReadPermissions);

    let response = await request.post('/auth/github').send({ authorizationCode: 'authToken' });

    expect(response).hasStatus(200);
    expect(response.body).has.deep.property('data.type', 'github-users');
    expect(response.body).has.deep.property('data.id', id);
    expect(response.body).has.deep.property('data.meta.source', 'github');
    expect(response.body.data.attributes).to.deep.equal({
      name: 'Hassan Abdel-Rahman',
      email: 'hassan@cardstack.com',
      'avatar-url': 'https://avatars2.githubusercontent.com/u/61075?v=4',
      permissions: ['cardstack/repo1:read'],
    });
    expect(response.body.data.meta.token).is.ok;
    expect(response.body.data.meta.validUntil).is.ok;
  });
});
