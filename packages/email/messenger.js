const logger = require('heimdalljs-logger')('email');
const nodemailer = require('nodemailer');

module.exports = class EmailMessenger {
  static create() {
    return new this();
  }
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.mailgun.org',
      auth: {
        user: 'postmaster@sandbox04556bcaa9df4aaa8d710c5e788964c0.mailgun.org',
        pass: '969f44a67f135c0ad4fd0c156731eec6'
      }
    }, {
      from: 'edward@eaf4.com'
    });
  }
  async send(message, params) {
    return this.transporter.sendMail(message);
  }
};
