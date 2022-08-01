import { inject } from '@cardstack/di';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { PrepaidCardColorScheme } from '@prisma/client';

export default class PrepaidCardColorSchemeSerializer {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async serialize(id: string): Promise<JSONAPIDocument>;
  async serialize(model: PrepaidCardColorScheme): Promise<JSONAPIDocument>;
  async serialize(content: string | PrepaidCardColorScheme): Promise<JSONAPIDocument> {
    if (typeof content === 'string') {
      content = await this.loadPrepaidCardColorScheme(content);
    }
    let data = {
      id: content.id,
      type: 'prepaid-card-color-schemes',
      attributes: {
        background: content.background,
        'pattern-color': content.patternColor,
        'text-color': content.textColor,
        description: content.description,
      },
    };
    let result = {
      data,
    } as JSONAPIDocument;
    return result;
  }

  async loadPrepaidCardColorScheme(id: string): Promise<PrepaidCardColorScheme> {
    let prisma = await this.prismaManager.getClient();

    let model = await prisma.prepaidCardColorScheme.findUnique({ where: { id } });
    if (!model) {
      return Promise.reject(new Error(`No prepaid_card_color_scheme record found with id ${id}`));
    }
    return {
      id: model.id,
      background: model.background,
      patternColor: model.patternColor,
      textColor: model.textColor,
      description: model.description,
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-color-scheme-serializer': PrepaidCardColorSchemeSerializer;
  }
}
