const nock = require('nock');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  githubUsersResponse,
  githubAdminPermissions,
  githubWritePermissions,
  githubReadPermissions,
  githubNoPermissions
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

  describe('github no permissions configured', function() {
    async function setup() {
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'github').withAttributes({
        sourceType: '@cardstack/github-auth',
        params: {
          'client-id': 'mock-github-client-id',
          'client-secret': 'mock-github-client-secret',
          token: 'mock-github-token',
        }
      });

      env = await createDefaultEnvironment(`${__dirname}/github-authenticator`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    }

    beforeEach(setup);
    afterEach(teardown);

    it('does not set permissions for user when no permissions configured', async function() {
      let userMock = Object.assign({}, githubUsersResponse);
      let { login:id } = userMock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(200, userMock);

      let user = await searchers.get(env.session, 'github-users', id);
      expect(user.data.attributes.permissions.length).to.equal(0);
    });
  });

  describe('github user permissions', function() {
    async function setup() {
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'github').withAttributes({
        sourceType: '@cardstack/github-auth',
        params: {
          'client-id': 'mock-github-client-id',
          'client-secret': 'mock-github-client-secret',
          token: 'mock-github-token',
          permissions: [
            { repo: 'cardstack/repo1', permission: 'read' },
            { repo: 'cardstack/repo1', permission: 'write' },
            { repo: 'cardstack/repo1', permission: 'admin' },

            { repo: 'cardstack/repo2', permission: 'read' },

            { repo: 'cardstack/repo3', permission: 'write' },
          ]
        }
      });

      env = await createDefaultEnvironment(`${__dirname}/github-authenticator`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    }

    beforeEach(setup);
    afterEach(teardown);

    it('does not set permissions for user with no access to repo', async function() {
      let userMock = Object.assign({}, githubUsersResponse);
      let permissionMock = Object.assign({}, githubNoPermissions);
      let { login:id } = userMock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(200, userMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo1/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo2/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo3/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      let user = await searchers.get(env.session, 'github-users', id);
      expect(user.data.attributes.permissions.length).to.equal(0);
    });

    it('can set permissions for user with read access on repo', async function() {
      let userMock = Object.assign({}, githubUsersResponse);
      let permissionMock = Object.assign({}, githubReadPermissions);
      let { login:id } = userMock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(200, userMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo1/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo2/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo3/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      let user = await searchers.get(env.session, 'github-users', id);

      expect(user.data.attributes.permissions).to.include('cardstack/repo1:read');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo1:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo1:admin');

      expect(user.data.attributes.permissions).to.include('cardstack/repo2:read');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo2:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo2:admin');

      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:read');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:admin');
    });

    it('can set permissions for user with write access on repo', async function() {
      let userMock = Object.assign({}, githubUsersResponse);
      let permissionMock = Object.assign({}, githubWritePermissions);
      let { login:id } = userMock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(200, userMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo1/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo2/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo3/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      let user = await searchers.get(env.session, 'github-users', id);

      expect(user.data.attributes.permissions).to.include('cardstack/repo1:read');
      expect(user.data.attributes.permissions).to.include('cardstack/repo1:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo1:admin');

      expect(user.data.attributes.permissions).to.include('cardstack/repo2:read');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo2:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo2:admin');

      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:read');
      expect(user.data.attributes.permissions).to.include('cardstack/repo3:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:admin');
    });

    it('can set permissions for user with admin access on repo', async function() {
      let userMock = Object.assign({}, githubUsersResponse);
      let permissionMock = Object.assign({}, githubAdminPermissions);
      let { login:id } = userMock;

      nock('https://api.github.com')
        .get(`/users/${id}`)
        .reply(200, userMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo1/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo2/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      nock('https://api.github.com')
        .get(`/repos/cardstack/repo3/collaborators/${id}/permission`)
        .reply(200, permissionMock);

      let user = await searchers.get(env.session, 'github-users', id);

      expect(user.data.attributes.permissions).to.include('cardstack/repo1:read');
      expect(user.data.attributes.permissions).to.include('cardstack/repo1:write');
      expect(user.data.attributes.permissions).to.include('cardstack/repo1:admin');

      expect(user.data.attributes.permissions).to.include('cardstack/repo2:read');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo2:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo2:admin');

      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:read');
      expect(user.data.attributes.permissions).to.include('cardstack/repo3:write');
      expect(user.data.attributes.permissions).to.not.include('cardstack/repo3:admin');
    });
  });

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

      let user = await searchers.get(env.session, 'github-users', id);

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

      await searchers.get(env.session, 'github-users', id);
      mock.name = "Van Gogh";

      let user = await searchers.get(env.session, 'github-users', id);
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

      await searchers.get(env.session, 'github-users', id);
      mock.name = "Van Gogh";

      await alterExpiration('master', 'github-users', id, '-30 seconds');

      let user = await searchers.get(env.session, 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Hassan Abdel-Rahman");

      await alterExpiration('master', 'github-users', id, '-31 seconds');

      user = await searchers.get(env.session, 'github-users', id);
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

      await searchers.get(env.session, 'github-users', id);
      mock.name = "Van Gogh";

      await alterExpiration('master', 'github-users', id, '-61 seconds');

      let user = await searchers.get(env.session, 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Hassan Abdel-Rahman");

      await alterExpiration('master', 'github-users', id, '-240 seconds');
      user = await searchers.get(env.session, 'github-users', id);
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

      await searchers.get(env.session, 'github-users', id);
      mock.name = "Van Gogh";

      let user = await searchers.get(env.session, 'github-users', id);
      expect(user).has.deep.property('data.attributes.name', "Van Gogh");
    });
  });
});
