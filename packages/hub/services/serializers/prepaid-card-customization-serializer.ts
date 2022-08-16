import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import PrepaidCardColorSchemeSerializer from './prepaid-card-color-scheme-serializer';
import PrepaidCardPatternSerializer from './prepaid-card-pattern-serializer';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { PrepaidCardCustomization } from '@prisma/client';

type PrepaidCardCustomizationWithoutCreatedAt = Omit<PrepaidCardCustomization, 'createdAt'>;

interface PrepaidCardCustomizationSerializationOptions {
  include: PrepaidCardCustomizationRelationship[];
}
type PrepaidCardCustomizationRelationship = 'colorScheme' | 'pattern';

export default class PrepaidCardCustomizationSerializer {
  prepaidCardColorSchemeSerializer: PrepaidCardColorSchemeSerializer = inject('prepaid-card-color-scheme-serializer', {
    as: 'prepaidCardColorSchemeSerializer',
  });
  prepaidCardPatternSerializer: PrepaidCardPatternSerializer = inject('prepaid-card-pattern-serializer', {
    as: 'prepaidCardPatternSerializer',
  });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async serialize(id: string, options: Partial<PrepaidCardCustomizationSerializationOptions>): Promise<JSONAPIDocument>;
  async serialize(
    model: PrepaidCardCustomizationWithoutCreatedAt,
    options: Partial<PrepaidCardCustomizationSerializationOptions>
  ): Promise<JSONAPIDocument>;
  async serialize(
    content: string | PrepaidCardCustomizationWithoutCreatedAt,
    options: Partial<PrepaidCardCustomizationSerializationOptions> = {}
  ): Promise<JSONAPIDocument> {
    if (typeof content === 'string') {
      content = await this.loadPrepaidCardCustomization(content);
    }
    let did = encodeDID({ type: 'PrepaidCardCustomization', uniqueId: content.id });
    let data = {
      id: content.id,
      type: 'prepaid-card-customizations',
      attributes: {
        did,
        'issuer-name': content.issuerName,
        'owner-address': content.ownerAddress,
      },
      relationships: {
        pattern: {
          data: {
            id: content.patternId,
            type: 'prepaid-card-patterns',
          },
        },
        'color-scheme': {
          data: {
            id: content.colorSchemeId,
            type: 'prepaid-card-color-schemes',
          },
        },
      },
    };
    let result = {
      meta: {
        network: config.get('web3.layer2Network'),
      },
      data,
    } as JSONAPIDocument;
    if (options.include?.includes('colorScheme')) {
      result.included = result.included || [];
      result.included.push((await this.prepaidCardColorSchemeSerializer.serialize(content.colorSchemeId)).data);
    }
    if (options.include?.includes('pattern')) {
      result.included = result.included || [];
      result.included.push((await this.prepaidCardPatternSerializer.serialize(content.patternId)).data);
    }
    return result;
  }

  async loadPrepaidCardCustomization(id: string): Promise<PrepaidCardCustomizationWithoutCreatedAt> {
    let prisma = await this.prismaManager.getClient();
    let model = await prisma.prepaidCardCustomization.findUnique({ where: { id } });
    if (!model) {
      return Promise.reject(new Error(`No prepaid_card_customization record found with id ${id}`));
    }
    return {
      id: model.id,
      issuerName: model.issuerName,
      ownerAddress: model.ownerAddress,
      patternId: model.patternId,
      colorSchemeId: model.colorSchemeId,
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-customization-serializer': PrepaidCardCustomizationSerializer;
  }
}
