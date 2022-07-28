import { Prisma, PrismaClient } from '@prisma/client';

type EmailCardDropStateGetter = Prisma.EmailCardDropStateDelegate<any>;

interface EmailCardDropStateExtensions {
  read(): Promise<boolean>;
  updateState(rateLimited: boolean): ReturnType<EmailCardDropStateGetter['upsert']>;
}

export interface ExtendedEmailCardDropState extends EmailCardDropStateGetter, EmailCardDropStateExtensions {}

export function getEmailCardDropStateExtension(client: PrismaClient) {
  let extension: EmailCardDropStateExtensions = {
    async read() {
      let result = await client.emailCardDropState.findFirst({
        where: {
          id: 1,
        },
      });
      return result?.rateLimited || false;
    },
    updateState(rateLimited: boolean) {
      return client.emailCardDropState.upsert({
        where: {
          id: 1,
        },
        create: {
          id: 1,
          rateLimited,
          updatedAt: new Date(),
        },
        update: {
          rateLimited,
        },
      });
    },
  };

  return extension;
}
