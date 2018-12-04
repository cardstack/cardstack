module.exports = function (user) {
  return {
    data: user,
    meta: { 'cardstack-cache-control': { 'max-age': 60 } }
  };
};
