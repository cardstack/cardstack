class Session {
  constructor(payload, userSearcher, optionalUser, optionalGroupIds) {
    this.payload = payload;
    this.userSearcher = userSearcher;
    this._user = optionalUser;
    this._groupIds = optionalGroupIds;
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

  async loadGroupIds() {
    if (!this._groupIds) {
      this._groupIds = [this.id];
    }
    return this._groupIds;
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
