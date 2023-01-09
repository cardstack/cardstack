import { inject } from '@cardstack/di';
import Koa from 'koa';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import { isAddress } from 'web3-utils';
let log = Logger('route:reward-proofs');
export default class RewardProofsRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    try {
      let prisma = await this.prismaManager.getClient();
      let payee = ctx.params.payee;
      if (payee && !isAddress(payee)) {
        ctx.status = 422;
        ctx.body = {
          status: '422',
          title: 'Invalid payee address',
        };
        return;
      }
      let rewardProgramId = ctx.request.query.rewardProgramId as string;
      if (rewardProgramId && !isAddress(rewardProgramId)) {
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
    } catch (e) {
      log.error('Failed to retrieve reward proofs', e);
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'reward-proofs-route': RewardProofsRoute;
  }
}
