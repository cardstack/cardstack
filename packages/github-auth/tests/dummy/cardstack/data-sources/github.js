module.exports = [
  {
    type: 'data-sources',
    id: 'github',
    attributes: {
      'source-type': '@cardstack/github-auth',
      params: {
        'client-id': process.env.GITHUB_CLIENT_ID,
        'client-secret': process.env.GITHUB_CLIENT_SECRET,
        token: process.env.GITHUB_TOKEN,
        permissions: [
          { repo: 'cardstack/cardstack', permission: 'read' },
          { repo: 'cardstack/cardstack', permission: 'write' },
          { repo: 'cardstack/cardstack', permission: 'admin' },
        ],
      },
    },
  },
  {
    type: 'grants',
    id: 'login',
    attributes: {
      'may-login': true,
    },
    relationships: {
      who: {
        data: [{ type: 'groups', id: 'everyone' }],
      },
    },
  },
  {
    type: 'grants',
    id: 'see-myself',
    attributes: {
      'may-read-resource': true,
      'may-read-fields': true,
    },
    relationships: {
      who: {
        data: [{ type: 'fields', id: 'id' }],
      },
      types: {
        data: [{ type: 'content-types', id: 'github-users' }],
      },
    },
  },
];
