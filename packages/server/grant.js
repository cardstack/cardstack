const actions = [
  'mayCreateResource',
  'mayReadResource',
  'mayUpdateResource',
  'mayDeleteResource',
  'mayReadField',
  'mayWriteField'
];

module.exports = class Grant {
  constructor(document) {
    for (let action of actions) {
      this[action] = !!document.attributes[action];
    }
    this.types = null;
    this.fields = null;
    if (document.relationships) {
      if (document.relationships.fields) {
        this.fields = document.relationships.fields.data.map(ref => ref.id);
      }
      if (document.relationships.types) {
        this.types = document.relationships.types.data.map(ref => ref.id);
      }
    }
  }
  matches(/* document, context */) {
    return false;
  }
};
