module.exports = function(user) {
  return {
    data: {
      id: user.upstreamId,
      type: "test-users"
    }
  };
};
