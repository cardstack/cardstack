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
