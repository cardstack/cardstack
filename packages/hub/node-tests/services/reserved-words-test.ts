import ReservedWordsService from '../../services/reserved-words';

const lowercaseAlphanumeric = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

describe('ReservedWordsService', function () {
  it('can detect a reserved word', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isReserved('Chris Tse')).equal(true);
  });

  it('can detect a reserved word with transforms', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isReserved('christse', lowercaseAlphanumeric)).equal(true);
  });

  it('will not match a non-profane, non-exact reserved word', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isReserved('Chris Tse 22')).equal(false);
  });

  it('can detect a profane word', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isProfane('fuck')).equal(true);
  });

  it('can detect a profane word with transforms', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isProfane('leatherrestraint', lowercaseAlphanumeric)).equal(true);
  });

  it('can detect a profane word in the midst of other words', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isProfane('fuck thats awful')).equal(true);
  });

  it('detects profane words when checking reserved words', async function () {
    let reservedWordsService = new ReservedWordsService();

    expect(reservedWordsService.isReserved('fuck thats awful')).equal(true);
  });
});
