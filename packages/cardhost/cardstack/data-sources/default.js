let sources = [
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'default' },
      },
    },
  },

  // TODO this is for testing only--eventually we should
  // only use mock-auth in the development and test environments
  {
    type: 'data-sources',
    id: 'mock-auth',
    attributes: {
      'source-type': '@cardstack/mock-auth',
      params: {
        users: {
          user1: {
            name: 'Carl Stack',
            email: 'carlstack@cardstack.com',
            verified: true,
          },
        },
      },
    },
  },
];

if (process.env.HUB_ENVIRONMENT === 'production') {
  sources.push({
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/git',
      params: {
        branchPrefix: process.env.GIT_BRANCH_PREFIX,
        remote: {
          url: process.env.GIT_REPO,
        },
      },
    },
  });
} else {
  sources.push({
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/ephemeral',
    },
  });
}

module.exports = sources;
