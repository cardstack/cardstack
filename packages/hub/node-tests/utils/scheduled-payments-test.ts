import { addMonths, subHours } from 'date-fns';
import { calculateNextPayAt } from '../../utils/scheduled-payments';

describe('ScheduledPaymentUtils', function () {
  let recurringDay = 5;

  // In below assertions, toISOString is used to compare dates because we want to make sure that
  // we compare UTC dates. On the other side of the comparison, we use the YYYY-MM-DDT00:00:00.000Z format
  // for the same reason (Z is at the end to indicate UTC time).

  it('calculates next pay at when current day number is lower than recurring day', function () {
    let prevPayAt = new Date(Date.parse('2022-02-04T00:00:00.000Z'));

    let nextPayAt = calculateNextPayAt(prevPayAt, recurringDay, addMonths(prevPayAt, 5));
    expect(nextPayAt?.toISOString()).to.equal('2022-02-05T00:00:00.000Z');
  });

  it('calculates next pay at when current day number is the same as recurring day', function () {
    let prevPayAt = new Date(Date.parse('2022-02-05T00:00:00.000Z'));
    let nextPayAt = calculateNextPayAt(prevPayAt, recurringDay, addMonths(prevPayAt, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-03-05T00:00:00.000Z');
  });

  it('calculates next pay at when current day number is higher same as recurring day', function () {
    let prevPayAt = new Date(Date.parse('2022-02-06T00:00:00.000Z'));

    let nextPayAt = calculateNextPayAt(prevPayAt, recurringDay, addMonths(prevPayAt, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-03-05T00:00:00.000Z');
  });

  it('calculates next pay is null when recurring until is earlier than date now', function () {
    let createdDate = new Date(Date.parse('2022-02-05T00:00:00.000Z'));
    let recurringUntil = subHours(createdDate, 1);
    let nextPayAt = calculateNextPayAt(createdDate, recurringUntil.getDate(), recurringUntil);

    expect(nextPayAt).to.null;
  });

  it('throws an error when recurring day is not in the range of 1-31', function () {
    let now = new Date();
    expect(() => calculateNextPayAt(now, 0, addMonths(now, 5))).to.throw();
    expect(() => calculateNextPayAt(now, 32, addMonths(now, 5))).to.throw();
    expect(() => calculateNextPayAt(now, 1, addMonths(now, 5))).to.not.throw();
    expect(() => calculateNextPayAt(now, 31, addMonths(now, 5))).to.not.throw();
  });

  it('sets the last day of month when month has less days than recurringDay case 1', function () {
    // February 2022 has 28 days. If recurringDay is set to 31th, payAt should be set to 28th.
    let startingDate = new Date(Date.UTC(2022, 1, 1)); // 2022-02-01 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(startingDate, 31, addMonths(startingDate, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-02-28T00:00:00.000Z');
  });

  it('sets the last day of month when month has less days than recurringDay case 2', function () {
    // February 2022 has 28 days. If recurringDay is set to 31th, payAt should be set to 28th.
    let startingDate = new Date(Date.UTC(2022, 1, 27)); // 2022-02-27 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(startingDate, 31, addMonths(startingDate, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-02-28T00:00:00.000Z');
  });

  it('sets the last day of month when month has less days than recurringDay case 3', function () {
    // February 2022 has 28 days. If recurringDay is set to 31st and we're on 28th, next payAt should be set to March 31st
    let startingDate = new Date(Date.UTC(2022, 1, 28)); // 2022-02-28 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(startingDate, 31, addMonths(startingDate, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-03-31T00:00:00.000Z');
  });

  it('sets the last day of month when month has less days than recurringDay case 4', function () {
    // April has 30 days. If recurringDay is set to 31st, payAt should be set to 30th.
    let startingDate = new Date(Date.UTC(2022, 3, 1)); // 2022-04-01 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(startingDate, 31, addMonths(startingDate, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-04-30T00:00:00.000Z');
  });

  it('sets the last day of month when month has less days than recurringDay case 5', function () {
    // April has 30 days. If recurringDay is set to 31st and we're on 30th, next payAt should be set to May 31st.
    let startingDate = new Date(Date.UTC(2022, 3, 30)); // 2022-04-30 (months are zero-indexed)
    let nextPayAt = calculateNextPayAt(startingDate, 31, addMonths(startingDate, 5));

    expect(nextPayAt?.toISOString()).to.equal('2022-05-31T00:00:00.000Z');
  });
});
