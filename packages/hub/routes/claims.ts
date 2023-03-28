import { inject } from '@cardstack/di';
import Koa from 'koa';
import autoBind from 'auto-bind';

export default class ClaimsRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    let callerCheckTypeHash = ctx.request.query.callerCheckTypeHash as string | undefined;
    let signed = ctx.request.query.signed === 'true';

    // Find all claims with matching caller check type hash
    let claims = await prisma.claim.findMany({
      where: {
        callerCheckTypeHash,
      },
    });

    let data;
    if (signed) {
      let claimIds = claims.map((claim) => claim.id);
      let signedClaims = await prisma.signedClaim.findMany({
        where: {
          claimId: {
            in: claimIds,
          },
        },
      });
      // Append signed claims to their respective claims
      data = claims.map((claim) => {
        return { claim, o: signedClaims.find((signedClaim) => signedClaim.claimId === claim.id) };
      });
    } else {
      data = claims;
    }

    ctx.status = 200;
    ctx.body = { data };
    ctx.type = 'application/json';
  }

  async post(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    let claim = ctx.request.body;
    let result = await prisma.claim.create({
      data: {
        id: claim.id,
        chainId: claim.chainId,
        moduleAddress: claim.moduleAddress,
        typeHash: claim.typeHash,
        stateCheckStructName: claim.stateCheckStructName,
        stateCheckTypeHash: claim.typeHash,
        stateCheckData: JSON.stringify(claim.stateCheckData),
        callerCheckStructName: claim.callerCheckStructName,
        callerCheckTypeHash: claim.callerCheckTypeHash,
        callerCheckData: JSON.stringify(claim.callerCheckData),
        actionStructName: claim.actionStructName,
        actionTypeHash: claim.actionTypeHash,
        actionData: JSON.stringify(claim.actionData),
      },
    });
    let data = result;
    ctx.status = 201;
    ctx.body = { data };
    ctx.type = 'application/json';
  }

  async postSign(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    let signedClaim = ctx.request.body;
    let claimId = ctx.params.claimId;

    let result = await prisma.signedClaim.create({
      data: {
        id: signedClaim.id,
        claimId: claimId,
        signature: signedClaim.signature,
        encoded: signedClaim.encoded,
        validator: signedClaim.validator,
      },
    });

    let data = result;
    ctx.status = 201;
    ctx.body = { data };
    ctx.type = 'application/json';
  }
}
declare module '@cardstack/di' {
  interface KnownServices {
    'claims-route': ClaimsRoute;
  }
}
