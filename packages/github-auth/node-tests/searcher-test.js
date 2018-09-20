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

  async function alterExpiration(branch, type, id, interval) {
    let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    let result = await client.query('update documents set expires = expires + $1 where branch=$2 and type=$3 and id=$4', [interval, branch, type, id]);
    if (result.rowCount !== 1) {
      throw new Error(`test was unable to alter expiration`);
    }
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('default cache control', function() {
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

    beforeEach(setup);
    afterEach(teardown);

    it('can get github user', async function() {
      let mock = Object.assign({}, githubUsersResponse);
      let { login:id } = mock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(function() {
          return [ 200, mock, {
            'cache-control': 'private, max-age=60, s-maxage=60'
          }];
        });

      let user = await searchers.get(env.session, 'master', 'github-users', id);

      expect(user).has.deep.property('data.id', id);
      expect(user).has.deep.property('data.type', 'github-users');
      expect(user).has.deep.property('data.attributes.name', githubUsersResponse.name);
      expect(user).has.deep.property('data.attributes.email', githubUsersResponse.email);
      expect(user).has.deep.property('data.attributes.avatar-url', githubUsersResponse.avatar_url);
    });

    it('can cache github users', async function() {
      let mock = Object.assign({}, githubUsersResponse);
      let { login:id } = mock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(function() {
          return [ 200, mock, {
            'cache-control': 'private, max-age=60, s-maxage=60'
          }];
        });

      await searchers.get(env.session, 'master', 'github-users', id);
      mock.name = "Van Gogh";

      let user = await searchers.get(env.session, 'master', 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Hassan Abdel-Rahman");
    });

    it('can invalidate cached github users using github provided cache-control', async function() {
      let mock = Object.assign({}, githubUsersResponse);
      let { login:id } = mock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .times(2)
        .reply(function() {
          return [ 200, mock, {
            'cache-control': 'private, max-age=60, s-maxage=60'
          }];
        });

      await searchers.get(env.session, 'master', 'github-users', id);
      mock.name = "Van Gogh";

      await alterExpiration('master', 'github-users', id, '-30 seconds');

      let user = await searchers.get(env.session, 'master', 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Hassan Abdel-Rahman");

      await alterExpiration('master', 'github-users', id, '-31 seconds');

      user = await searchers.get(env.session, 'master', 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Van Gogh");
    });
  });

  describe('custom cache control', function() {
    async function setup() {
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'github').withAttributes({
        sourceType: '@cardstack/github-auth',
        params: {
          'client-id': 'mock-github-client-id',
          'client-secret': 'mock-github-client-secret',
          token: 'mock-github-token',
          'cache-max-age': 300
        }
      });

      env = await createDefaultEnvironment(`${__dirname}/github-authenticator`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    }

    beforeEach(setup);
    afterEach(teardown);

    it('can invalidate cached github users using custom cache-control', async function() {
      let mock = Object.assign({}, githubUsersResponse);
      let { login:id } = mock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .times(2)
        .reply(function() {
          return [ 200, mock, {
            'cache-control': 'private, max-age=60, s-maxage=60'
          }];
        });

      await searchers.get(env.session, 'master', 'github-users', id);
      mock.name = "Van Gogh";

      await alterExpiration('master', 'github-users', id, '-61 seconds');

      let user = await searchers.get(env.session, 'master', 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Hassan Abdel-Rahman");

      await alterExpiration('master', 'github-users', id, '-240 seconds');
      user = await searchers.get(env.session, 'master', 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Van Gogh");
    });
  });

  describe('no caching', function() {
    async function setup() {
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'github').withAttributes({
        sourceType: '@cardstack/github-auth',
        params: {
          'client-id': 'mock-github-client-id',
          'client-secret': 'mock-github-client-secret',
          token: 'mock-github-token',
          'cache-max-age': 0
        }
      });

      env = await createDefaultEnvironment(`${__dirname}/github-authenticator`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    }

    beforeEach(setup);
    afterEach(teardown);

    it('can not cache github users', async function() {
      let mock = Object.assign({}, githubUsersResponse);
      let { login:id } = mock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .times(2)
        .reply(function() {
          return [ 200, mock, {
            'cache-control': 'private, max-age=60, s-maxage=60'
          }];
        });

      await searchers.get(env.session, 'master', 'github-users', id);
      mock.name = "Van Gogh";

      let user = await searchers.get(env.session, 'master', 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Van Gogh");
    });
  });
});
