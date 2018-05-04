class Session {

  // payload must have at least `id` and `type` (which together are
  // the jsonapi reference to the current user's resource.
  //
  // optionalUser can be a jsonapi document representing that user (a
  // full document, including the top-level `data` property)
  constructor(payload, userSearcher, optionalUser, optionalRealms) {
    this.payload = payload;
    this.userSearcher = userSearcher;
    this._user = optionalUser;
    this._realms = optionalRealms;
  }
  get id() {
    return this.payload.id;
  }
  get type() {
    return this.payload.type;
  }

  async loadUser() {
    if (!this._user) {
      if (this.id != null && this.type != null) {
        this._user = await this.userSearcher.get(this.type, this.id);
      }
    }
    return this._user;
  }

  // right now, realms are equal to group ids. But we have the
  // flexibility in the future to do more optimization, such that we
  // can reduce the set of realms down to something smaller than the
  // set of groups (since many groups may have overlapping areas of
  // access)
  async realms() {
    if (!this._realms) {
      if (!this.userSearcher || !this.userSearcher.get ) {
        throw new Error(`no valid user searcher in session for ${this.type} ${this.id}`);
      }

      let ownBaseRealm = Session.encodeBaseRealm(this.type, this.id);

      let realmsDoc;
      try {
        realmsDoc = await this.userSearcher.get('user-realms', ownBaseRealm);
      } catch(err) {
        if (err.status !== 404) {
          throw err;
        }
      }
      if (realmsDoc && realmsDoc.data && realmsDoc.data.attributes && realmsDoc.data.attributes.realms) {
        this._realms = [...realmsDoc.data.attributes.realms, everyoneRealm];
      } else {
        this._realms = [ownBaseRealm, everyoneRealm];
      }
    }
    return this._realms;
  }

  static encodeBaseRealm(type, id) {
    return `${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
  }

}

const everyoneRealm = Session.encodeBaseRealm('groups', 'everyone');


module.exports = Session;

// This is the session that Hub uses when taking its own actions in
// the system.  The user id "@cardstack/hub" is special -- it has a
// grant to do all the things (see bootstrap-schema.js)
let privilegedSession;
Object.defineProperty(Session, 'INTERNAL_PRIVILEGED', {
  get() {
    if (!privilegedSession) {
      privilegedSession = new Session(
        { id: '@cardstack/hub', type: 'groups' },
        null,
        {
          id: '@cardstack/hub',
          type: 'groups',
          attributes: {
            'full-name': '@cardstack/hub/authentication',
            email: 'noreply@nowhere.com'
          }
        },
        [Session.encodeBaseRealm('groups', '@cardstack/hub'), everyoneRealm]
      );
    }
    return privilegedSession;
  }
});

// This is the default lowest-privileged session
let everyoneSession;
Object.defineProperty(Session, 'EVERYONE', {
  get() {
    if (!everyoneSession) {
      everyoneSession = new Session(
        { id: 'everyone', type: 'users' },
        null,
        {
          id: 'everyone',
          type: 'users',
          attributes: {
            'full-name': 'Anonymous',
            email: 'noreply@nowhere.com'
          }
        },
        [everyoneRealm]
      );
    }
    return everyoneSession;
  }
});
