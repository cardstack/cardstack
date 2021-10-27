import { cardQueryToSQL, queryParamsToCardQuery } from '../../utils/queries';

describe('Queries', function () {
  describe('queryParamsToCardQuery', function () {
    it('converts adoptsFrom query param', async function () {
      expect(queryParamsToCardQuery({ adoptsFrom: 'https://my-realm/person' })).to.deep.equal({
        filter: {
          in: { adoptsFrom: 'https://my-realm/person' },
        },
      });

      expect(function () {
        queryParamsToCardQuery({ names: 'sue' });
      }).to.throw(/Invalid query params/);
    });
  });

  describe('cardQueryToSQL', function () {
    it('converts adoptsFrom query param', async function () {
      expect(
        cardQueryToSQL({
          filter: {
            in: { adoptsFrom: 'https://my-realm/person' },
          },
        })
      ).to.equal("SELECT * FROM card_index WHERE 'https://my-realm/person' = ANY adoptsFrom");

      expect(
        cardQueryToSQL({
          filter: {
            in: { name: 'bob' },
          },
        })
      ).to.equal("SELECT * FROM card_index WHERE 'bob' = ANY name");

      expect(
        cardQueryToSQL({
          filter: {
            in: { name: 'bob', what: 'no way' },
          },
        })
      ).to.equal("SELECT * FROM card_index WHERE 'bob' = ANY name AND 'no way' = ANY what");
    });
  });
});
