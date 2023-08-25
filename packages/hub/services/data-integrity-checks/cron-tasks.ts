import { inject } from '@cardstack/di';
import { Client } from 'pg';
import { IntegrityCheckResult } from './utils';

import config from 'config';

export type TaskIdentifier =
  | 'check-reward-roots'
  | 'execute-scheduled-payments'
  | 'remove-old-sent-notifications'
  | 'print-queued-jobs';

interface TaskConfig {
  cronMinutes: number;
}

interface CronTask {
  'execute-scheduled-payments': TaskConfig;
  'check-reward-roots': TaskConfig;
  'print-queued-jobs': TaskConfig;
  'remove-old-sent-notifications': TaskConfig;
}

// graphile worker configuration (copied from worker-client)
const TASK: CronTask = {
  'execute-scheduled-payments': { cronMinutes: 5 },
  'check-reward-roots': { cronMinutes: 10 },
  'print-queued-jobs': { cronMinutes: 5 },
  'remove-old-sent-notifications': { cronMinutes: 600 },
};

let DEFAULT_MULTIPLIER = 3;

interface TaskCheckResult {
  stopped: boolean;
  identifier: string;
  checkMinutes: number;
  lastExecution: Date | null;
  cronMinutes: number;
}

const checkTask = async (
  db: Client,
  identifier: TaskIdentifier,
  multiplier: number = DEFAULT_MULTIPLIER
): Promise<TaskCheckResult> => {
  const query = `
      SELECT 
        COALESCE((current_timestamp - last_execution) >= make_interval(mins => $2) OR last_execution IS NULL, false) AS stopped,
        identifier,   
        $2 AS "checkMinutes",
        last_execution as "lastExecution" 
    FROM 
        graphile_worker.known_crontabs
    WHERE 
        identifier = $1;
  `;
  let taskConfig = TASK[identifier];
  let minutes = taskConfig.cronMinutes * multiplier;
  let { rows: data } = await db.query(query, [identifier, minutes]);
  return { ...data[0], cronMinutes: taskConfig.cronMinutes };
};

export default class DataIntegrityChecksCronTasks {
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  rewardsEnabled = config.get('rewardsIndexer.enabled');

  async check(): Promise<IntegrityCheckResult> {
    let db = await this.databaseManager.getClient();

    let checks = [
      await checkTask(db, 'remove-old-sent-notifications'),
      await checkTask(db, 'print-queued-jobs'),
      await checkTask(db, 'execute-scheduled-payments'),
    ];
    if (config.get('rewardsIndexer.enabled')) {
      checks.push(await checkTask(db, 'check-reward-roots'));
    }

    let errorMessages = checks.reduce((acc: string[], check: TaskCheckResult) => {
      if (check.stopped) {
        return [
          ...acc,
          `"${check.identifier}" has not run within ${check.checkMinutes} minutes tolerance (supposed to be every ${check.cronMinutes} minutes). Last execution is ${check.lastExecution}`,
        ];
      }
      return acc;
    }, []);

    return {
      name: 'cron-tasks',
      status: checks.filter((o: any) => o.stopped === true).length > 0 ? 'degraded' : 'operational',
      message: errorMessages.length > 0 ? errorMessages.join('; ') : null,
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'data-integrity-checks-cron-tasks': DataIntegrityChecksCronTasks;
  }
}
