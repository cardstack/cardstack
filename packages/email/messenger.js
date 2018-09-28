const log = require('@cardstack/logger')('cardstack/email');
const nodemailer = require('nodemailer');

module.exports = class EmailMessenger {
  static create(params) {
    return new this(params);
  }
  constructor(params) {
    this.params = params;

    if(params.useSes) {
      // If SES is required, you must add aws-sdk to the consuming project
      const aws = require("aws-sdk");  // eslint-disable-line node/no-missing-require, node/no-extraneous-require
      if (!params.defaultFrom) {
        throw new Error(`Could not find defaultFrom in message sink params`);
      }

      let config = { apiVersion: '2010-12-01' };

      if (process.env.SES_REGION) {
        config.region = process.env.SES_REGION;
      }

      log.debug(`Configuring email messenger using SES with config ${JSON.stringify(config,null,2)}`);

      this.transporter = nodemailer.createTransport({
        SES: new aws.SES(config)
      }, {
        from: params.defaultFrom
      });

    } else {
      ['smtpPasswordEnvVar', 'smtpHost', 'smtpUser', 'defaultFrom'].forEach( prop => {
        if (!params[prop]) {
          throw new Error(`Could not find ${prop} in message sink params`);
        }
      });

      log.debug(`Configuring email messenger using SMTP with host: ${params.smtpHost}, user: ${params.smtpUser}, defaultFrom: ${params.defaultFrom} (password not logged)`);

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

  }
  async send(message) {
    log.info(`Sending mail to ${message.to}: ${message.subject}`);
    return this.transporter.sendMail(message);
  }
};
