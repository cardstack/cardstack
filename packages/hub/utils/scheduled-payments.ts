import { addMonths, isBefore } from 'date-fns';
import { convertDateToUTC } from './dates';

export function calculateNextPayAt(fromDate: Date, recurringDay: number) {
  let nowUtc = convertDateToUTC(fromDate);
  let nextPayAtUtc = convertDateToUTC(fromDate); // We want a fresh date object, so that we don't mutate the original one (setDate mutates the original date object))

  nextPayAtUtc.setDate(recurringDay);

  if (nextPayAtUtc.getTime() === nowUtc.getTime() || isBefore(nextPayAtUtc, nowUtc)) {
    nextPayAtUtc = addMonths(nextPayAtUtc, 1);
  }

  return nextPayAtUtc;
}
