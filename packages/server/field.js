const Error = require('@cardstack/data-source/error');
const moment = require('moment-timezone');

module.exports = class Field {
  constructor(model) {
    this.id = model.id;
    this.fieldType = model.document['field-type'];
  }
  async validationErrors(value) {
    if (this.fieldType === 'string') {
      if (value != null && typeof value !== 'string') {
        return [new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`)];
      }
    }
    if (this.fieldType === 'date' && value != null) {
      let date = moment(value, moment.ISO_8601);
      if (!date.isValid()) {
        return [new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`)];
      }
    }

    return [];
  }
};
