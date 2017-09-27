const logger = require('@cardstack/plugin-utils/logger')('email');
const nodemailer = require('nodemailer');

module.exports = class EmailMessenger {
  static create(params) {
    return new this(params);
  }
  constructor(params) {
    this.params = params;
    ['smtpPasswordEnvVar', 'smtpHost', 'smtpUser', 'defaultFrom'].forEach( prop => {
      if (!params[prop]) {
        throw new Error(`Could not find ${prop} in message sink params`);
      }
    });
    this.transporter = nodemailer.createTransport({
      host: params.smtpHost,
      auth: {
        user: params.smtpUser,
        pass: process.env[params.smtpPasswordEnvVar]
      }
    }, {
      from: params.defaultFrom
    });
  }
  async send(message) {
    logger.info(`Sending mail to ${message.to}: ${message.subject}`);
    return this.transporter.sendMail(message);
  }
};
