import { Prisma, PrismaClient } from '@prisma/client';

type LatestEventBlockGetter = Prisma.LatestEventBlockDelegate<any>;

export interface ExtendedLatestEventBlock extends LatestEventBlockGetter {
  read(): Promise<number | undefined>;
  updateBlockNumber(blockNumber: number): ReturnType<LatestEventBlockGetter['upsert']>;
}

export function getLatestEventBlockExtension(client: PrismaClient) {
  return {
    async read() {
      let result = await client.latestEventBlock.findFirst({
        where: {
          id: 1,
        },
      });
      return result?.blockNumber;
    },
    updateBlockNumber(blockNumber: Number) {
      // Insert if empty, update but only if the block number is higher
      return client.$executeRaw`
        INSERT INTO latest_event_block (id, block_number)
        VALUES (1, ${blockNumber})
  
        ON CONFLICT (id)
        DO UPDATE SET
          block_number = GREATEST(
            ${blockNumber},
            (SELECT block_number FROM latest_event_block WHERE id = 1)
          ),
          updated_at = NOW()
      `;
    },
  };
}
