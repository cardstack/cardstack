import { convertDateToUTC } from './dates';

// This function will return the next payment date based on the frequency.
// fromDate will be either the current date when a recurring scheduled is created,
// or the date of the last payment.
export function calculateNextPayAt(fromDate: Date, recurringDay: number) {
  if (recurringDay < 1 || recurringDay > 31) {
    throw new Error('Recurring day must be in the range of 1-31');
  }

  let nextPayAtUtc = convertDateToUTC(fromDate);

  // We take min() because some months can have less days than the recurring day (e.g. there is no Feb 31)
  let adjustedRecurringDay = Math.min(recurringDay, daysInMonth(fromDate));
  if (fromDate.getUTCDate() < adjustedRecurringDay) {
    nextPayAtUtc.setUTCDate(adjustedRecurringDay); // next pay this month
  } else {
    nextPayAtUtc.setUTCMonth(nextPayAtUtc.getUTCMonth() + 1);
    nextPayAtUtc.setUTCDate(Math.min(recurringDay, daysInMonth(nextPayAtUtc)));
  }

  return nextPayAtUtc;
}

function daysInMonth(date: Date) {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getDate();
}
