import { NOT_NULL, buildConditions } from '../../utils/queries';

describe('Queries utils', function () {
  describe('buildConditions', function () {
    it('returns correct values', async function () {
      expect(buildConditions({ a: 1, b: 2 })).to.deep.equal({ where: 'a=$1 AND b=$2', values: [1, 2] });

      expect(buildConditions({ a: 1, b: null, c: 2 })).to.deep.equal({
        where: 'a=$1 AND c=$2 AND b IS NULL',
        values: [1, 2],
      });

      expect(buildConditions({ a: 1, b: NOT_NULL, c: 2 })).to.deep.equal({
        where: 'a=$1 AND c=$2 AND b IS NOT NULL',
        values: [1, 2],
      });

      expect(buildConditions({ a: 'test', non_literals: { should_be: 'ignored' } })).to.deep.equal({
        where: 'a=$1',
        values: ['test'],
      });
    });

    it('can prepend a table name', async function () {
      expect(buildConditions({ a: 1, b: 2 }, 'table_name')).to.deep.equal({
        where: 'table_name.a=$1 AND table_name.b=$2',
        values: [1, 2],
      });
    });
  });
});
