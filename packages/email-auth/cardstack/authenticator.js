module.exports = class {
  static create() {
    return new this();
  }

  async authenticate({ email }, sourceParams, userSearcher) {
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
    }
  }
};
