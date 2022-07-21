import { inject } from '@cardstack/di';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { PrepaidCardPattern } from '@prisma/client';

export default class PrepaidCardPatternSerializer {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async serialize(id: string): Promise<JSONAPIDocument>;
  async serialize(model: PrepaidCardPattern): Promise<JSONAPIDocument>;
  async serialize(content: string | PrepaidCardPattern): Promise<JSONAPIDocument> {
    if (typeof content === 'string') {
      content = await this.loadPrepaidCardPattern(content);
    }
    let data = {
      id: content.id,
      type: 'prepaid-card-patterns',
      attributes: {
        'pattern-url': content.patternUrl,
        description: content.description,
      },
    };
    let result = {
      data,
    } as JSONAPIDocument;
    return result;
  }

  async loadPrepaidCardPattern(id: string): Promise<PrepaidCardPattern> {
    let prisma = await this.prismaManager.getClient();
    let pattern = await prisma.prepaidCardPattern.findUnique({ where: { id } });

    if (!pattern) {
      return Promise.reject(new Error(`No prepaid_card_pattern record found with id ${id}`));
    }

    return pattern;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-pattern-serializer': PrepaidCardPatternSerializer;
  }
}
