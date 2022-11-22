import { isValidDate } from '../../utils/dates';

describe('DateUtils', function () {
  it('validates a date', function () {
    expect(isValidDate(new Date('abc'))).to.be.false;
    expect(isValidDate(new Date(1669153655))).to.be.true;
    expect(isValidDate(new Date('2022-11-22'))).to.be.true;
    expect(isValidDate(new Date('2022-11-22T21:47:09.449Z'))).to.be.true;
  });
});
