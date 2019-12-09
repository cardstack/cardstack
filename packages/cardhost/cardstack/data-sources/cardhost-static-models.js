/*
  This is saying that the cardhost app itself is also a data source.
  Specifically, it implements cardstack/static-model.js to emit schemas
*/
module.exports = [
  {
    type: 'data-sources',
    id: 'cardhost-static-models',
    attributes: {
      'source-type': '@cardstack/cardhost',
    },
  },
];
