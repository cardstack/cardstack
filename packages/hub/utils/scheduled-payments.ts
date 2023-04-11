import { addMonths } from 'date-fns';
import { convertDateToUTC } from './dates';

// This function will return the next payment date based on the frequency.
// fromDate will be either the current date when a recurring scheduled is created,
// or the date of the last payment.
// When a recurring scheduled is created the recurringUntil parameter must be not undefined.
// currentDate is needed for testing purpose.
export function calculateNextPayAt(
  recurringDay: number,
  recurringUntil: Date,
  options?: {
    lastPayAt?: Date;
    currentDate?: Date;
  }
) {
  if (recurringDay < 1 || recurringDay > 31) {
    throw new Error('Recurring day must be in the range of 1-31');
  }
  let nowUtc = convertDateToUTC(options?.currentDate ?? new Date());
  let recurringUntilUtc = convertDateToUTC(recurringUntil);

  let nextPayAt;
  if (options?.lastPayAt) {
    nextPayAt = addMonths(options.lastPayAt, 1);
  } else if (recurringDay >= nowUtc.getDate()) {
    nextPayAt = nowUtc;
  } else {
    nextPayAt = addMonths(nowUtc, 1);
  }
  // We take min() because some months can have less days than the recurring day (e.g. there is no Feb 31)
  nextPayAt.setUTCDate(Math.min(recurringDay, daysInMonth(nextPayAt)));

  if (nextPayAt <= recurringUntilUtc) {
    return nextPayAt;
  } else {
    return null; // Recurring payment expired, there is no next pay date
  }
}

function daysInMonth(date: Date) {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getDate();
}
