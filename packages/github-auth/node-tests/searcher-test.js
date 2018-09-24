const nock = require('nock');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  githubUsersResponse
} = require('./fixtures/github-responses');

describe('github-auth/searcher', function() {
  let env, searchers;

  async function setup() {
    let factory = new JSONAPIFactory();

    factory.addResource('data-sources', 'github').withAttributes({
      sourceType: '@cardstack/github-auth',
      params: {
        'client-id': 'mock-github-client-id',
        'client-secret': 'mock-github-client-secret',
        token: 'mock-github-token'
      }
    });

    env = await createDefaultEnvironment(`${__dirname}/github-authenticator`, factory.getModels());
    searchers = env.lookup('hub:searchers');
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  before(setup);
  after(teardown);

  it('can get github user', async function() {
    const { login:id } = githubUsersResponse;

    nock('https://api.github.com')
      .get(`/users/${id}`)
      .reply(function() {
        return [ 200, githubUsersResponse, {
          'Cache-Control': 'private, max-age=60, s-maxage=60'
        }];
      });

    let user = await searchers.get(env.session, 'master', 'github-users', id);

    expect(user).has.deep.property('data.id', id);
    expect(user).has.deep.property('data.type', 'github-users');
    expect(user).has.deep.property('data.attributes.name', githubUsersResponse.name);
    expect(user).has.deep.property('data.attributes.email', githubUsersResponse.email);
    expect(user).has.deep.property('data.attributes.avatar-url', githubUsersResponse.avatar_url);
  });
});
