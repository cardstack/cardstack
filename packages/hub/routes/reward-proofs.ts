import { inject } from '@cardstack/di';
import Koa from 'koa';
import autoBind from 'auto-bind';
export default class RewardProofsRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    let payee = ctx.params.payee;
    let rewardProgramId = ctx.request.query.rewardProgramId as string;
    let proofs = await prisma.rewardProof.findMany({
      where: {
        payee,
        rewardProgramId,
      },
    });
    ctx.type = 'application/vnd.api+json';
    ctx.status = 200;
    ctx.body = proofs;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'reward-proofs-route': RewardProofsRoute;
  }
}
