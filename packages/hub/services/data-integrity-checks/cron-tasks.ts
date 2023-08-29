import { inject } from '@cardstack/di';
import { IntegrityCheckResult } from './utils';
import { CRON_TAB } from '../../worker';
import { calculateMinuteInterval } from './cron-tab-utils';
export type TaskIdentifier =
  | 'check-reward-roots'
  | 'execute-scheduled-payments'
  | 'remove-old-sent-notifications'
  | 'print-queued-jobs';

let DEFAULT_MULTIPLIER = 3;

export interface TaskCheck {
  identifier: string;
  lagging: boolean;
  lastExecution: Date | null;
  errorMessage?: string;
}

export default class DataIntegrityChecksCronTasks {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  async check(): Promise<IntegrityCheckResult> {
    let db = await this.databaseManager.getClient();

    let checks = await Promise.all(
      CRON_TAB.map(async (expression: string) => {
        let { identifier, minuteInterval } = calculateMinuteInterval(expression);
        let minuteThreshold = minuteInterval * DEFAULT_MULTIPLIER;
        let query = `
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
        let { rows: data } = await db.query(query, [identifier, minuteThreshold]);
        let r = { ...data[0], minuteInterval };
        if (r.lagging) {
          r.errorMessage = `"${r.identifier}" has not run within ${r.minuteThreshold} minutes tolerance (supposed to be every ${r.minuteInterval} minutes). Last execution is ${r.lastExecution}`;
        }
        return r;
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
