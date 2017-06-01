exports.authenticate = async function({ email }, sourceParams, userSearcher) {
  if (email) {
    return {
      user: {
        type: 'users',
        attributes: {
          email
        }
      }
    };
  }
};
