import ReservedWordsService from '../../services/reserved-words';

let reservedWordsService = new ReservedWordsService();
describe('ReservedWordsService', function () {
  it('can detect a reserved word', async function () {
    expect(reservedWordsService.isReserved('Chris Tse')).equal(true);
  });

  it('can detect a reserved word with transforms', async function () {
    expect(reservedWordsService.isReserved('christse', reservedWordsService.lowerCaseAlphaNumericTransform)).equal(
      true
    );
  });

  it('will not match a non-profane, non-exact reserved word', async function () {
    expect(reservedWordsService.isReserved('Chris Tse 22')).equal(false);
  });

  it('can detect a profane word', async function () {
    expect(reservedWordsService.isProfane('fuck')).equal(true);
  });

  it('can detect a profane word with transforms', async function () {
    expect(
      reservedWordsService.isProfane('leatherrestraint', reservedWordsService.lowerCaseAlphaNumericTransform)
    ).equal(true);
  });

  it('can detect a profane word in the midst of other words', async function () {
    expect(reservedWordsService.isProfane('fuck thats awful')).equal(true);
  });

  it('detects profane words when checking reserved words', async function () {
    expect(reservedWordsService.isReserved('fuck thats awful')).equal(true);
  });
});
