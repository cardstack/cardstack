/*

  DISCLAIMER: I'm documenting how I want these to work. I have not yet
  certified that they do. -ef4


  A grant is a combination of:

   - a group that is receiving permissions

   - one or more permissions (may-read-resource, may-write-fields, etc)

   - an optional types restriction, which limits both resource-level
     and field-level permissions in the grant to only the listed
     content-types.

   - an optional fields restriction, which limits any field-level
     permissions in the grant to only the listed fields.


  Permissions Architecture

  Permissions fall into two categories: per-resource and
  per-field. Here I will explain how permissions interact under each
  CRUD operation:


  * Create

    When you try to create a resource, we first check for
    may-read-resource and may-create-resource. It's not possible to
    create a resource that you aren't authorized to read, because
    JSON:API POST always echos back the created object.

    After you pass those two resource-level checks, we move on to
    field-level checks.

    You must have may-read-fields for each field that you
    include. This is for the same reason as needing may-read-resource
    -- JSON:API always echos back when you do a write, so we insist
    that you have read permissions too.

    You must have may-write-fields for each field that you include
    that has a value different from its default-at-create value. This
    means we are tolerant of including a field that you don't have
    permission to modify, so long as you aren't actually trying to
    modify it.

    To set a user-provided "id", the user needs may-write-fields
    permission on "id". Without it, they are forced to accept a
    server-provided id.

  * Read

    When you try to read a resource, we first check for
    may-read-resource. If you don't have it, you will see a 404,
    because you aren't authorized to know whether the resource even
    exists.

    After you pass that resource-level check, we apply field level
    checks to limit the response. The response will only includes
    fields for which you have the may-read-fields permission.

    The "type" and "id" fields are fundamental to JSON:API, so you do
    not need explicit may-read-fields permission for them. They are
    implicitly allowed to be read as long as you have
    may-read-resource.

    If you lack may-read-fields permission on a relationship field, it
    won't be present in data.relationships in the response, and so it
    necessarily also cannot be present in data.includes (because the
    JSON:API spec requires full linkage).

    If you have may-read-fields permission on a relationship field, it
    will be present in data.relationships. In order for a related
    resource to also appear in `includes` (either because you asked
    for it via the `?include=` query parameter or because of the
    schema's default-includes) you must have may-read-resource
    permission on the related resource, and we will recurse into it to
    enforce field level may-read-resource permissions.

    In other words, having may-read-fields on a relationship field is
    distinct from having may-read-resource on the resource that the
    relationship points at.

  * Update

    When you try to update a resource, we first check for
    may-read-resource and may-update-resource. It's not possible to
    update a resource that you aren't authorized to read, because
    JSON:API PATCH always echos back the modified object.

    After you pass those two resource-level checks, we move on to
    field-level checks.

    You must have may-read-fields for each field that you
    include. This is for the same reason as needing may-read-resource
    -- JSON:API always echos back when you do a write, so we insist
    that you have read permissions too. We are also avoiding a
    potential information leak, because if we tolerated the presence
    of a field you're not allowed to read, it would let you probe for
    the current value, since may-write-fields is deliberately tolerant
    of unchanged values.

    For each field you include, we check for may-writes-fields *if*
    the value of the field differs from what it would have been if you
    didn't include the field at all. "What it would have been" depends
    on the old value of the field and any default-at-update in the
    schema.

  * Delete

    When you try to delete a resource, we check for
    may-delete-resource, and that's it. We aren't checking
    may-read-resource because a DELETE doesn't echo back the resource.

    In practice, you will usually need may-read-resource anyway,
    because many data sources require an If-Match header on DELETE, in
    order to avoid race conditions, and you won't be able to come up
    with the current version for If-Match without first reading the
    resource.

*/
const actions = [
  'may-create-resource',
  'may-read-resource',
  'may-update-resource',
  'may-delete-resource',
  'may-read-fields',
  'may-write-fields'
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
