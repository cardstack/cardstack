import { addMonths } from 'date-fns';
import { convertDateToUTC } from './dates';

// This function will return the next payment date based on the frequency.
// fromDate will be either the current date when a recurring scheduled is created,
// or the date of the last payment.
export function calculateNextPayAt(fromDate: Date, recurringDay: number) {
  if (recurringDay < 1 || recurringDay > 31) {
    throw new Error('Recurring day must be in the range of 1-31');
  }

  let fromDateUtc = convertDateToUTC(fromDate);
  let nextPayAtUtc = convertDateToUTC(fromDate);

  // We take min() because some months can have less days than the recurring day (e.g. there is no Feb 31)
  let adjustedRecurringDay = Math.min(recurringDay, daysInMonth(fromDateUtc));
  if (fromDate.getDate() < adjustedRecurringDay) {
    nextPayAtUtc.setDate(adjustedRecurringDay); // next pay this month
  } else {
    nextPayAtUtc = addMonths(nextPayAtUtc, 1); // next pay next month
    nextPayAtUtc.setDate(Math.min(recurringDay, daysInMonth(nextPayAtUtc)));
  }

  return nextPayAtUtc;
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
