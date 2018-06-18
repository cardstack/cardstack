module.exports = function(user) {
  return {
    data:{
      type: "test-users",
      attributes: {
        "full-name": `${user.firstName} ${user.lastName}`,
        email: user.email
      }
    }
  };
};
