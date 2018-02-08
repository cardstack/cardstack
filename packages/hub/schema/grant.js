const actions = [
  'may-create-resource',
  'may-read-resource',
  'may-update-resource',
  'may-delete-resource',
  'may-read-field',
  'may-write-field'
];
const log = require('@cardstack/logger')('cardstack/auth');
const Session = require('@cardstack/plugin-utils/session');

module.exports = class Grant {
  constructor(document) {
    let attrs = document.attributes || {};
    let rels = document.relationships || {};

    for (let action of actions) {
      this[action] = !!attrs[action];
    }

    this.types = null;
    this.fields = null;
    this.id = document.id;
    if (this.id == null) {
      throw new Error(`grant must have an id: ${JSON.stringify(document)}`);
    }

    if (rels.fields && rels.fields.data.length > 0) {
      this.fields = rels.fields.data.map(ref => ref.id);
    }

    if (rels.types && rels.types.data.length > 0) {
      this.types = rels.types.data.map(ref => ref.id);
    }

    if (rels.who && rels.who.data) {
      if (rels.who.data.type !== 'groups') {
        throw new Error(`grant's "who" field must refer to a group: ${JSON.stringify(document)}`);
      }
      this.groupId = rels.who.data.id;
    } else {
      throw new Error(`grant must have a "who" field: ${JSON.stringify(document)}`);
    }
  }

  async matches(document, context) {
    let groupIds = await (context.session || Session.EVERYONE).realms();
    let matches = this.groupId == null || groupIds.includes(this.groupId);
    log.trace('testing grant id=%s groupId=%s document=%j context=%j matches=%s', this.id, this.groupId, document, context, !!matches);
    return matches;
  }

};
