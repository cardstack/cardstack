// having difficulty using node's util.promisify in the truffle tests, i think it's related to the context binding....
function promisify(fn) {
  return args => new Promise((res, rej) => {
    fn(args, (err, result) => {
      if (err) {
        rej(err);
      } else {
        res(result);
      }
    });
  });
}

module.exports = {
  promisify
};