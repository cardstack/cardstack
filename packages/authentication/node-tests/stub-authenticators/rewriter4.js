module.exports = function(user) {
  let output = {
    data:{
      type: "doggies",
      attributes: {
        "full-name": user.data.attributes.fullName,
        email: user.data.attributes.email
      }
    }
  };
  if (user.data.attributes['secret-rating']) {
    output.data.attributes['secret-rating'] = user.data.attributes['secret-rating'];
  }
  return output;
};
