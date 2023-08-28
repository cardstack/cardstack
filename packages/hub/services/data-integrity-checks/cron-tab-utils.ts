import { Client } from 'pg';
import { type ParsedCronItem } from 'graphile-worker';

let DEFAULT_MULTIPLIER = 3;

abstract class CronChecker<T extends ParsedCronItem, C extends TaskCheck> {
  abstract check(db: Client, parsedCronItem: T): Promise<TaskCheck>;

  abstract isType(item: ParsedCronItem): item is T;

  abstract errorMessage(check: C): string;
}

type AtTimeEveryDay = ParsedCronItem;
type MinuteIntervalLessThanHour = ParsedCronItem;

export interface TaskCheck {
  identifier: string;
  lagging: boolean;
  lastExecution: Date | null;
  errorMessage?: string;
}

interface MinuteIntervalLessThanHourCheck extends TaskCheck {
  minuteThreshold: number;
  cronMinutes: number;
}

interface AtTimeEveryDayCheck extends TaskCheck {
  hour: number;
  minute: number;
  dayThreshold: number;
  cronDays: number;
}

export class MinuteIntervalLessThanHourChecker extends CronChecker<
  MinuteIntervalLessThanHour,
  MinuteIntervalLessThanHourCheck
> {
  interval(item: MinuteIntervalLessThanHour): number {
    const sortedMinutes = [...item.minutes].sort((a, b) => a - b);
    return sortedMinutes[1] - sortedMinutes[0];
  }
  async check(
    db: Client,
    parsedCronItem: MinuteIntervalLessThanHour,
    multiplier: number = DEFAULT_MULTIPLIER
  ): Promise<MinuteIntervalLessThanHourCheck> {
    const query = `
      SELECT 
        COALESCE((current_timestamp - last_execution) >= make_interval(mins => $2) OR last_execution IS NULL, false) AS lagging,
        identifier,   
        $2 AS "minuteThreshold",
        last_execution as "lastExecution" 
    FROM 
        graphile_worker.known_crontabs
    WHERE 
        identifier = $1;
  `;
    let cronMinutes = this.interval(parsedCronItem);
    let minuteThreshold = cronMinutes * multiplier;
    let { rows: data } = await db.query(query, [parsedCronItem.identifier, minuteThreshold]);
    let r = { ...data[0], cronMinutes };
    if (r.lagging) {
      r.errorMessage = this.errorMessage(r);
    }
    return r;
  }
  isType(item: ParsedCronItem): item is MinuteIntervalLessThanHour {
    if (item.hours.length !== 24 || item.dows.length !== 7 || item.months.length !== 12 || item.dates.length !== 31) {
      return false;
    }
    if (item.minutes.length <= 1) {
      return false;
    }

    if (item.hours.length === 24 && item.minutes.length > 1) {
      const sortedMinutes = [...item.minutes].sort((a, b) => a - b);

      let consistentInterval = true;
      const expectedInterval = sortedMinutes[1] - sortedMinutes[0];

      for (let i = 1; i < sortedMinutes.length - 1; i++) {
        if (sortedMinutes[i + 1] - sortedMinutes[i] !== expectedInterval) {
          consistentInterval = false;
          break;
        }
      }

      if (consistentInterval && expectedInterval > 0 && expectedInterval < 60) {
        return true;
      }
    }
    return false;
  }
  errorMessage(check: MinuteIntervalLessThanHourCheck): string {
    return `"${check.identifier}" has not run within ${check.minuteThreshold} minutes tolerance (supposed to be every ${check.cronMinutes} minutes). Last execution is ${check.lastExecution}`;
  }
}

export class AtTimeEveryDayChecker extends CronChecker<AtTimeEveryDay, AtTimeEveryDayCheck> {
  time(item: AtTimeEveryDay) {
    return {
      hour: item.hours[0],
      minute: item.minutes[0],
    };
  }
  interval(): number {
    return 1;
  }
  async check(
    db: Client,
    parsedCronItem: AtTimeEveryDay,
    multiplier: number = DEFAULT_MULTIPLIER
  ): Promise<AtTimeEveryDayCheck> {
    const query = `
    SELECT 
  COALESCE(
    (current_timestamp > (last_execution + make_interval(days => $2, hours => $3, mins => $4)))
    OR last_execution IS NULL, 
    false
  ) AS lagging,
  identifier,   
  $2 AS "dayThreshold",
  last_execution as "lastExecution" 
FROM 
  graphile_worker.known_crontabs
WHERE 
  identifier = $1;
`;

    let checkDays = this.interval() * multiplier;
    const { hour, minute } = this.time(parsedCronItem);

    let { rows: data } = await db.query(query, [parsedCronItem.identifier, checkDays, hour, minute]);
    let r = { ...data[0], cronDays: checkDays, hour, minute };
    if (r.lagging) {
      r.errorMessage = this.errorMessage(r);
    }
    return r;
  }

  isType(item: ParsedCronItem): item is AtTimeEveryDay {
    return (
      item.hours.length === 1 &&
      item.minutes.length === 1 &&
      item.dates.length === 31 &&
      item.months.length === 12 &&
      item.dows.length === 7
    );
  }
  errorMessage(check: AtTimeEveryDayCheck): string {
    return `"${check.identifier}" has not run within ${check.dayThreshold} days tolerance (It's supposed to run every day at ${check.hour} hour ${check.minute} minutes). Last execution is ${check.lastExecution}`;
  }
}
