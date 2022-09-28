import { format } from 'date-fns';
import { calculateNextPayAt } from '../../utils/scheduled-payments';

describe('ScheduledPaymentUtils', function () {
  let recurringDay = 5;

  it('calculates next pay at when current day number is lower than recurring day', function () {
    let fromDate = new Date(Date.parse('2022-02-04'));

    let nextPayAt = calculateNextPayAt(fromDate, recurringDay);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-02-05');
  });

  it('calculates next pay at when current day number is the same as recurring day', function () {
    let fromDate = new Date(Date.parse('2022-02-05'));

    let nextPayAt = calculateNextPayAt(fromDate, recurringDay);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-03-05');
  });

  it('calculates next pay at when current day number is higher same as recurring day', function () {
    let fromDate = new Date(Date.parse('2022-02-06'));

    let nextPayAt = calculateNextPayAt(fromDate, recurringDay);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-03-05');
  });

  it('throws an error when recurring day is not in the range of 1-31', function () {
    expect(() => calculateNextPayAt(new Date(), 0)).to.throw();
    expect(() => calculateNextPayAt(new Date(), 32)).to.throw();
    expect(() => calculateNextPayAt(new Date(), 1)).to.not.throw();
    expect(() => calculateNextPayAt(new Date(), 31)).to.not.throw();
  });

  it('sets the last day of month when month has less days than recurringDay case 1', function () {
    // February 2022 has 28 days. If recurringDay is set to 31th, payAt should be set to 28th.
    let a = new Date(Date.UTC(2022, 1, 1)); // 2022-02-01 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(a, 31);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-02-28');
  });

  it('sets the last day of month when month has less days than recurringDay case 2', function () {
    // February 2022 has 28 days. If recurringDay is set to 31th, payAt should be set to 28th.
    let a = new Date(Date.UTC(2022, 1, 27)); // 2022-02-27 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(a, 31);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-02-28');
  });

  it('sets the last day of month when month has less days than recurringDay case 3', function () {
    // February 2022 has 28 days. If recurringDay is set to 31st and we're on 28th, next payAt should be set to March 30st.
    let a = new Date(Date.UTC(2022, 1, 28)); // 2022-02-28 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(a, 31);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-03-31');
  });

  it('sets the last day of month when month has less days than recurringDay case 4', function () {
    // April has 30 days. If recurringDay is set to 31st, payAt should be set to 30th.
    let a = new Date(Date.UTC(2022, 3, 1)); // 2022-04-01 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(a, 31);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-04-30');
  });

  it('sets the last day of month when month has less days than recurringDay case 5', function () {
    // April has 30 days. If recurringDay is set to 31st and we're on 30th, next payAt should be set to May 31st.
    let a = new Date(Date.UTC(2022, 3, 30)); // 2022-04-30 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(a, 31);

    expect(format(nextPayAt, 'yyyy-MM-dd')).to.equal('2022-05-31');
  });
});
