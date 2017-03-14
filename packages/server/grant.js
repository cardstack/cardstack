const actions = [
  'may-create-resource',
  'may-read-resource',
  'may-update-resource',
  'may-delete-resource',
  'may-read-field',
  'may-write-field'
];

module.exports = class Grant {
  constructor(document) {
    let attrs = document.attributes || {};
    let rels = document.relationships || {};

    for (let action of actions) {
      this[action] = !!attrs[action];
    }

    this.groupId = null;
    this.types = null;
    this.fields = null;

    if (rels.fields) {
      this.fields = rels.fields.data.map(ref => ref.id);
    }

    if (rels.types) {
      this.types = rels.types.data.map(ref => ref.id);
    }

    if (rels.who) {
      this.groupId = rels.who.data.id;
    }
  }

  matches(document, context) {
    return this.groupId == null || (context.user && this._memberCheck(context.user, this.groupId));
  }

  _memberCheck(user, groupId) {
    return String(user.id) === String(groupId);
  }
};
