const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  encryptor: 'hub:encryptor',
  messengers: 'hub:messengers'
},

class {
  async authenticate({ email, referer, secret }, { messageSinkId }, userSearcher) {
    if (email) {
      let { models } = await userSearcher.search({
        filter: {
          email: {
            exact: email
          }
        },
        page: { size: 1 }
      });

      if (models.length > 0) {
        if (!referer) {
          throw new Error("referer is required", { status: 400 });
        }
        let validSeconds = 60*60;
        let validUntil = Math.floor(Date.now()/1000 + validSeconds);
        let token = this.encryptor.encryptAndSign([models[0].id, validUntil]);
        await this.messengers.send(messageSinkId, {
          to: email,
          subject: 'Your Login Link',
          body: `Here's your link: ${referer}/redirect.html?secret=${token} `
        });
        return {
          partialSession: {
            attributes: {
              message: 'Check your email',
              state: 'pending-email'
            }
          }
        };
      } else {
        return {
          user: {
            type: 'users',
            attributes: {
              email
            }
          }
        };
      }
    } else if (secret) {
      let decrypted;
      try {
        decrypted = this.encryptor.verifyAndDecrypt(secret);
      } catch (err) {
        throw new Error('Unauthorized', { status : 401 });
      }
      let [userId, validUntil] = decrypted;
      if (validUntil < (new Date()) / 1000) {
        throw new Error("Unauthorized", { status: 401 });
      }
      let user = await userSearcher.get('users', userId);
      if (user) {
        return { preloadedUser: user };
      }
    }
  }
});
