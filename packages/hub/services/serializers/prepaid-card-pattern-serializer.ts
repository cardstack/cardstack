import { inject } from '@cardstack/di';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { prepaid_card_patterns } from '@prisma/client';

export default class PrepaidCardPatternSerializer {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async serialize(id: string): Promise<JSONAPIDocument>;
  async serialize(model: prepaid_card_patterns): Promise<JSONAPIDocument>;
  async serialize(content: string | prepaid_card_patterns): Promise<JSONAPIDocument> {
    if (typeof content === 'string') {
      content = await this.loadPrepaidCardPattern(content);
    }
    let data = {
      id: content.id,
      type: 'prepaid-card-patterns',
      attributes: {
        'pattern-url': content.pattern_url,
        description: content.description,
      },
    };
    let result = {
      data,
    } as JSONAPIDocument;
    return result;
  }

  async loadPrepaidCardPattern(id: string): Promise<prepaid_card_patterns> {
    let prisma = await this.prismaManager.getClient();
    let pattern = prisma.prepaid_card_patterns.findUnique({ where: { id } });

    if (!pattern) {
      return Promise.reject(new Error(`No prepaid_card_pattern record found with id ${id}`));
    }

    // TODO why? If it’s already known to not be null. CS-4255
    return pattern as unknown as prepaid_card_patterns;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-pattern-serializer': PrepaidCardPatternSerializer;
  }
}
