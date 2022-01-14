import { buildConditions } from '../../utils/queries';

describe('Queries utils', function () {
  describe('buildConditions', function () {
    it('returns correct values', async function () {
      expect(buildConditions({ a: 1, b: 2 })).to.deep.equal({ where: 'a=$1 AND b=$2', values: [1, 2] });

      expect(buildConditions({ a: 1, b: null, c: 2 })).to.deep.equal({
        where: 'a=$1 AND c=$2 AND b IS NULL',
        values: [1, 2],
      });
    });
  });
});
