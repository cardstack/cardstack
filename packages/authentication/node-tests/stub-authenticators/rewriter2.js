module.exports = function(user) {
  return {
    data:{
      id: `my-prefix-${user.id}`,
      type: "test-users",
      attributes: {
        "full-name": `${user.firstName} ${user.lastName}`,
        email: user.email
      }
    }
  };
};
