import { inject } from '@cardstack/di';
import WorkerClient from '../services/worker-client';
import { RewardPrograms, RewardRoots } from '../services/subgraph';
import { ProcessRewardRootPayload } from '../tasks/process-reward-root';

const MAX_INDEX_SIZE_PROGRAM = 1000;

export default class CheckRewardRoots {
  subgraph = inject('subgraph');
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });
  async perform(max_index_size_per_program = MAX_INDEX_SIZE_PROGRAM) {
    try {
      let db = await this.databaseManager.getClient();
      const r1: RewardPrograms = await this.subgraph.getRewardPrograms();
      const rewardProgramIds = r1?.data?.rewardPrograms.map((o) => o.id);
      for (const rewardProgramId of rewardProgramIds) {
        const LAST_INDEXED_BLOCK_QUERY = `SELECT COALESCE(MAX(block_number),0) as last_indexed_block_number FROM reward_root_index WHERE reward_program_id='${rewardProgramId}';`;
        const {
          rows: [{ last_indexed_block_number }],
        } = await db.query(LAST_INDEXED_BLOCK_QUERY);
        const r2: RewardRoots = await this.subgraph.getRewardRoots(
          rewardProgramId,
          last_indexed_block_number,
          max_index_size_per_program
        );
        let payloads: ProcessRewardRootPayload[] = r2?.data?.merkleRootSubmissions.map((root) => {
          return {
            blockNumber: root.blockNumber,
            s3FileInfo: {
              paymentCycle: root.paymentCycle,
              rewardProgramId: root.rewardProgram.id,
            },
          };
        });
        for (const payload of payloads) {
          // Process 1 parquet (rewardProgramId, paymentCycle) file at one time
          await this.workerClient.addJob('process-reward-root', payload, {
            jobKey: payload.s3FileInfo.rewardProgramId + '-' + payload.s3FileInfo.paymentCycle,
            maxAttempts: 1,
          });
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'check-reward-roots': CheckRewardRoots;
  }
}
