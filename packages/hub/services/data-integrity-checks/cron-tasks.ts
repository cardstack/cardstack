import { inject } from '@cardstack/di';
import { IntegrityCheckResult } from './utils';
import { parseCrontab, type ParsedCronItem } from 'graphile-worker';
import { CRON_TAB_STRING } from '../../worker';
import { AtTimeEveryDayChecker, MinuteIntervalLessThanHourChecker, TaskCheck } from './cron-tab-utils';
export type TaskIdentifier =
  | 'check-reward-roots'
  | 'execute-scheduled-payments'
  | 'remove-old-sent-notifications'
  | 'print-queued-jobs';

// graphile worker configuration (copied from worker-client)
let GRPAPHILE_WORKER_TASKS: ParsedCronItem[] = parseCrontab(CRON_TAB_STRING);

export default class DataIntegrityChecksCronTasks {
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  checkers = [new MinuteIntervalLessThanHourChecker(), new AtTimeEveryDayChecker()];

  async check(): Promise<IntegrityCheckResult> {
    let db = await this.databaseManager.getClient();

    let checks = await Promise.all(
      GRPAPHILE_WORKER_TASKS.map(async (parsedCronItem: ParsedCronItem) => {
        let checker = this.checkers.find((checker) => checker.isType(parsedCronItem));
        if (!checker) {
          throw new Error(`No checker found for ${parsedCronItem.identifier}`);
        }
        return await checker.check(db, parsedCronItem);
      })
    );

    let laggingChecks = checks.filter((o: TaskCheck) => o.lagging === true);
    let errorMessages = laggingChecks.map((check: TaskCheck) => check.errorMessage || '').filter(Boolean);

    return {
      name: 'cron-tasks',
      status: laggingChecks.length > 0 ? 'degraded' : 'operational',
      message: laggingChecks.length > 0 ? errorMessages.join('; ') : null,
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'data-integrity-checks-cron-tasks': DataIntegrityChecksCronTasks;
  }
}
