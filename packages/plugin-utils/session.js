class Session {

  // payload must have at least `id` and `type` (which together are
  // the jsonapi reference to the current user's resource.
  //
  // optionalUser can be a jsonapi document representing that user (a
  // full document, including the top-level `data` property)
  constructor(payload, userSearcher, optionalUser, optionalGroupIds) {
    this.payload = payload;
    this.userSearcher = userSearcher;
    this._user = optionalUser;
    this._realms = optionalGroupIds;
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
      if (this.id === 'everyone') {
        this._realms = ['everyone'];
      } else {
        this._realms = [this.id, 'everyone'];
      }
    }
    return this._realms;
  }

}

module.exports = Session;

// This is the session that Hub uses when taking its own actions in
// the system.  The user id "@cardstack/hub" is special -- it has a
// grant to do all the things (see bootstrap-schema.js)
let privlegedSession;
Object.defineProperty(Session, 'INTERNAL_PRIVLEGED', {
  get() {
    if (!privlegedSession) {
      privlegedSession = new Session(
        { id: '@cardstack/hub', type: 'users' },
        null,
        {
          id: '@cardstack/hub',
          type: 'users',
          attributes: {
            'full-name': '@cardstack/hub/authentication',
            email: 'noreply@nowhere.com'
          }
        }
      );
    }
    return privlegedSession;
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
        }
      );
    }
    return everyoneSession;
  }
});
