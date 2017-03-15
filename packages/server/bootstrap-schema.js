const models = Object.freeze([
  {
    type: 'plugin-configs',
    id: '@cardstack/core-field-types',
    attributes: {
      enabled: true
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/core-constraint-types',
    attributes: {
      enabled: true
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/git',
    attributes: {
      enabled: true
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/elasticsearch',
    attributes: {
      enabled: true
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/jsonapi',
    attributes: {
      enabled: true
    }
  }
]);
module.exports = models;
