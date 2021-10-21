import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';

interface PrepaidCardPattern {
  id: string;
  patternUrl?: string;
  description: string;
}
interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class PrepaidCardPatternSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

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
    let db = await this.databaseManager.getClient();
    let queryResult = await db.query('SELECT id, pattern_url, description FROM prepaid_card_patterns WHERE id = $1', [
      id,
    ]);
    if (queryResult.rowCount === 0) {
      return Promise.reject(new Error(`No prepaid_card_pattern record found with id ${id}`));
    }
    let row = queryResult.rows[0];
    return {
      id: row['id'],
      patternUrl: row['pattern_url'],
      description: row['description'],
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-pattern-serializer': PrepaidCardPatternSerializer;
  }
}
