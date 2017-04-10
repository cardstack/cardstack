const Error = require('@cardstack/plugin-utils/error');

// userInputs is whatever was posted to /auth/:your_module
//
// userSearcher is like Searcher#search except pre-curried with the
// controlling branch and the user content type.
exports.authenticate = async function(userInputs /*, userSearcher */) {
  let { password } = userInputs;
  if (password == null) {
    throw new Error("password is required", { status: 400 });
  }
  if (password === 'the-right-password') {
    return {
      // this is the minimum required output for a successful
      // authentication
      id: 42,

      // this is an optimization for when you already had to load the
      // record anyway
      loadedUser: null,

      // this allows an external service to provide default or updated
      // values for user fields. It should be formatted as a jsonapi
      // resource, just like loadedUser.
      updatedUser: null
    };
  }
};
