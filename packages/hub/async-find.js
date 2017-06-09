module.exports = async function find(list, predicate) {
  for (let element of list) {
    if (await predicate(element)) {
      return element;
    }
  }
};
