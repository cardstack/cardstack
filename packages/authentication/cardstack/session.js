class Session {
  constructor(payload, userSearcher) {
    this.payload = payload;
    this.userSearcher = userSearcher;
  }
  get id() {
    return this.payload.id;
  }
  get type() {
    return this.payload.type;
  }

  async loadUser() {
    if (this.id != null && this.type != null) {
      return this.userSearcher.get(this.type, this.id);
    }
  }
}

module.exports = Session;
