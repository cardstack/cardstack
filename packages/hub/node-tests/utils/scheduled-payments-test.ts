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
});
