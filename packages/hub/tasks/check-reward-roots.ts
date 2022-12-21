import { inject } from '@cardstack/di';
import WorkerClient from '../services/worker-client';
import { RewardPrograms, RewardRoots } from '../services/subgraph';

const MAX_INDEX_SIZE = 2; // Index max 2 roots per reward program

export default class CheckRewardRoots {
  subgraph = inject('subgraph');
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });
  async perform(max_index_size = MAX_INDEX_SIZE) {
    let db = await this.databaseManager.getClient();
    const r1: RewardPrograms = await this.subgraph.getRewardPrograms();
    const rewardProgramIds = r1?.data?.rewardPrograms.map((o) => o.id);
    for (const rewardProgramId of rewardProgramIds) {
      const LAST_INDEXED_BLOCK_QUERY = `SELECT COALESCE(MAX(payment_cycle),0) as last_indexed_block_number FROM reward_root_index WHERE reward_program_id='${rewardProgramId}';`;
      const {
        rows: [{ last_indexed_block_number }],
      } = await db.query(LAST_INDEXED_BLOCK_QUERY);
      const r2: RewardRoots = await this.subgraph.getRewardRoots(
        rewardProgramId,
        last_indexed_block_number,
        max_index_size
      );
      let files: S3FileInfo[] = r2?.data?.merkleRootSubmissions.map((root) => {
        return {
          paymentCycle: root.paymentCycle,
          rewardProgramId: root.rewardProgram.id,
        };
      });
      for (const file of files) {
        // Process 1 parquet (rewardProgramId, paymentCycle) file at one time
        await this.workerClient.addJob('process-reward-root', file, {
          jobKey: file.rewardProgramId + '-' + file.paymentCycle,
          maxAttempts: 1,
        });
      }
    }
  }
}

interface S3FileInfo {
  rewardProgramId: string;
  paymentCycle: string;
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'check-reward-roots': CheckRewardRoots;
  }
}
