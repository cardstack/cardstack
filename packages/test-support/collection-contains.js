module.exports = function(chai, utils) {
  const { Assertion } = chai;

  Assertion.addMethod('collectionContains', function (expected) {
    let obj = this._obj;

    utils.expectTypes(this, ['array']);

    let best = { hits: 0, candidate: {} };
    let keys = Object.keys(expected);

    for (let candidate of obj) {
      let hits = keys.map(key => utils.eql(candidate[key], expected[key]) ? 1 : 0).reduce((a,b) => a + b);
      if (hits > best.hits) {
        best = { hits, candidate };
      }
      if (best.hits === keys.length) {
        break;
      }
    }

    // always diff POJOs
    let actual = {};
    Object.entries(best.candidate).forEach(([k,v]) => actual[k] = v);


    this.assert(
      best.hits === keys.length,
      "expected #{this} to contain",
      "expected #{this} to not contain",
      expected,
      actual,
      true
    );
  });
};
