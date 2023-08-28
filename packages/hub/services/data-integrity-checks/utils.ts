import { TaskIdentifier } from './cron-tasks';
import { Client as DBClient } from 'pg';

export interface IntegrityCheckResult {
  name: string;
  status: 'degraded' | 'operational';
  message: string | null;
}

export type CronState = {
  [key in TaskIdentifier]: { minutesAgo: number };
};

export async function setupKnownCrontabs(db: DBClient, task: CronState): Promise<void> {
  const values = Object.entries(task)
    .map(
      ([identifier, config]) =>
        `('${identifier}', current_timestamp, current_timestamp - interval '${config.minutesAgo} minutes')`
    )
    .join(', ');

  if (values) {
    const query = `
          INSERT INTO graphile_worker.known_crontabs 
          (identifier, known_since, last_execution) 
          VALUES ${values};
      `;

    await db.query(query);
  }
}
