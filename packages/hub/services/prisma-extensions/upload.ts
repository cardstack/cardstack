import { Prisma, PrismaClient } from '@prisma/client';

type UploadGetter = Prisma.UploadDelegate<any>;

export interface ExtendedUpload extends UploadGetter {
  isAbusing(ownerAddress: string): Promise<boolean>;
}

export function getUploadExtension(client: PrismaClient) {
  return {
    async isAbusing(ownerAddress: string) {
      let result =
        await client.$queryRaw`SELECT COUNT(*) as count FROM uploads WHERE owner_address = ${ownerAddress} AND created_at > now() - INTERVAL '10 min'`;
      return (result as any)[0].count >= 10;
    },
  };
}
