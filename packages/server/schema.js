const Error = require('@cardstack/data-source/error');

module.exports = class Schema {
  static async loadFrom(searcher, branch) {
    let models = await searcher.search(branch, {
      type: ['content-types']
    });
    let types = new Map();
    for (let model of models) {
      if (model.type === 'content-types') {
        types.set(model.id, model);
      }
    }
    return new this(types);
  }

  constructor(types) {
    this.types = types;
  }

  validationErrors(document) {
    let errors = [];
    if (!this.types.has(document.type)) {
      errors.push(new Error(`"${document.type}" is not a valid type`, {
        status: 400,
        source: { pointer: '/data/type' }
      }));
    }
    return errors;
  }
};
