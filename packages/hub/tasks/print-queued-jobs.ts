import { Helpers } from 'graphile-worker';
import { inject } from '@cardstack/di';

const LIST_OTHER_JOBS_QUERY =
  "SELECT * FROM graphile_worker.jobs WHERE attempts < max_attempts AND task_identifier != 'print-queued-jobs';";
const COUNT_OTHER_JOBS_QUERY = LIST_OTHER_JOBS_QUERY.replace('*', 'COUNT(*)');

/**
 * Meant to be used as a cron job. Logs the Graphile Worker job queue
 */
export default class PrintQueuedJobs {
  private databaseManager = inject('database-manager', { as: 'databaseManager' });
  async perform(_payload: any, helpers: Helpers) {
    try {
      let db = await this.databaseManager.getClient();

      const {
        rows: [{ count }],
      } = await db.query(COUNT_OTHER_JOBS_QUERY);

      helpers.logger.info(`Queued jobs count: ${count}`);

      const { rows } = await db.query(LIST_OTHER_JOBS_QUERY);

      helpers.logger.info(`Queued jobs: ${JSON.stringify(rows, null, 2)}`);
    } catch (e) {
      helpers.logger.error('Failed to log jobs');
      throw e;
    }
  }
}
