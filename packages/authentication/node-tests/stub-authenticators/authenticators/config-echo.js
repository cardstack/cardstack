module.exports = class {
  static create(params) {
    return new this(params);
  }
  constructor(params) {
    this.params = params;
  }
  async authenticate() {
    return this.params;
  }
  async exposeConfig() {
    return { data: this.params.data };
  }
};
