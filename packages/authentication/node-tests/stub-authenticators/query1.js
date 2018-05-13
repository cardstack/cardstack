module.exports = function(user) {
  return {
    filter: {
      email: { "exact": user.data.attributes.email },
    },
    page: { size: 1 }
  };
};
