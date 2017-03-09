module.exports = function(chai, utils) {
  const { Assertion } = chai;

  Assertion.addMethod('collectionContains', function (entry) {
    let obj = this._obj;

    utils.expectTypes(this, ['array']);

    let best = { hits: 0, candidate: {} };
    let keys = Object.keys(entry);

    for (let candidate of obj) {
      let hits = keys.map(key => utils.eql(candidate[key], entry[key]) ? 1 : 0).reduce((a,b) => a + b);
      if (hits > best.hits) {
        best = { hits, candidate };
      }
      if (best.hits === keys.length) {
        break;
      }
    }

    this.assert(
      best.hits === keys.length,
      "expected collection to contain",
      "expected #{this} to not contain",
      entry,            // expected
      best.candidate,   // actual
      true
    );
  });
};
