import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import { validateRequiredFields } from './utils/validation';

export default class PrepaidCardCustomizationsRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  prepaidCardCustomizationSerializer = inject('prepaid-card-customization-serializer', {
    as: 'prepaidCardCustomizationSerializer',
  });
  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let prisma = await this.prismaManager.getClient();

    if (
      !validateRequiredFields(ctx, {
        requiredAttributes: ['issuer-name'],
        requiredRelationships: ['pattern', 'color-scheme'],
      })
    ) {
      return;
    }

    let issuerName = ctx.request.body.data.attributes['issuer-name'];
    let ownerAddress = ctx.state.userAddress;
    let patternId = ctx.request.body.data.relationships.pattern.data.id;
    let colorSchemeId = ctx.request.body.data.relationships['color-scheme'].data.id;
    let newId = shortUuid.uuid();

    try {
      await prisma.prepaidCardCustomization.create({
        data: {
          id: newId,
          ownerAddress,
          issuerName,
          colorSchemeId,
          patternId,
        },
      });
    } catch (e: any) {
      if (e.meta.field_name.endsWith('fkey (index)')) {
        return foreignKeyConstraintError(ctx, e.meta.field_name);
      } else {
        throw e;
      }
    }
    await this.workerClient.addJob('persist-off-chain-prepaid-card-customization', {
      id: newId,
    });

    let serializedPcc = await this.prepaidCardCustomizationSerializer.serialize(
      {
        id: newId,
        issuerName,
        ownerAddress,
        colorSchemeId,
        patternId,
      },
      {}
    );
    ctx.status = 201;
    ctx.body = serializedPcc;
    ctx.type = 'application/vnd.api+json';
  }
}

function foreignKeyConstraintError(ctx: Koa.Context, constraintName: string) {
  let relationshipName;
  switch (constraintName) {
    case 'prepaid_card_customizations_color_scheme_id_fkey (index)':
      relationshipName = 'color-scheme';
      break;
    case 'prepaid_card_customizations_pattern_id_fkey (index)':
      relationshipName = 'pattern';
      break;
  }
  let error;
  if (relationshipName) {
    let relationshipId = ctx.request.body.data.relationships[relationshipName].data.id;
    error = {
      status: '422',
      title: `Invalid relationship: ${relationshipName}`,
      detail: `Provided ID for ${relationshipName} relationship was not valid: ${relationshipId}`,
    };
    ctx.status = 422;
  } else {
    error = {
      status: '500',
      title: `Database constraint error: ${constraintName}`,
      detail: `A database constraint was violated: ${constraintName}`,
    };
    ctx.status = 500;
  }
  ctx.body = {
    errors: [error],
  };
  ctx.type = 'application/vnd.api+json';
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-customizations-route': PrepaidCardCustomizationsRoute;
  }
}
