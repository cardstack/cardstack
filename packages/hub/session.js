class Session {
  constructor(payload, userSearcher) {
    this.payload = payload;
    this.userSearcher = userSearcher;
  }
  get userId() {
    return this.payload.userId;
  }
  async loadUser() {
    let id = this.userId;
    if (id != null) {
      return this.userSearcher.get(id);
    }
  }
}

module.exports = Session;
