const Error = require('@cardstack/plugin-utils/error');
exports.authenticate = async function({ email }, userSearcher) {
  if (email == null) {
    throw new Error("email is required", { status: 400 });
  }
  let { models } = await userSearcher.search({ filter: { email: { exact: email } } });
  if (models.length > 0) {
    return {
      userId: models[0].id
    };
  }
};
