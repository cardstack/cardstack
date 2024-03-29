import { inject } from '@cardstack/di';
import Koa from 'koa';
import autoBind from 'auto-bind';
import Web3 from 'web3';

export default class RewardProofsRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    let payee = ctx.params.payee;
    if (payee && !Web3.utils.isAddress(payee)) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid payee address',
      };
      return;
    }
    let rewardProgramId = ctx.request.query.rewardProgramId as string;
    if (rewardProgramId && !Web3.utils.isAddress(rewardProgramId)) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid reward program id',
      };
      return;
    }
    let proofs = await prisma.rewardProof.findMany({
      where: {
        payee,
        rewardProgramId,
      },
    });
    let data = proofs.map((proof) => {
      return {
        id: proof.leaf,
        type: 'reward-proofs',
        attributes: proof,
      };
    });
    ctx.status = 200;
    ctx.body = { data };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'reward-proofs-route': RewardProofsRoute;
  }
}
