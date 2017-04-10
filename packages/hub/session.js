class Session {
  constructor(payload, userLookup) {
    this.payload = payload;
    this.userLookup = userLookup;
  }
  get userId() {
    return this.payload.userId;
  }
  async loadUser() {
    let id = this.userId;
    if (id != null) {
      return this.userLookup(id);
    }
  }
}

module.exports = Session;
