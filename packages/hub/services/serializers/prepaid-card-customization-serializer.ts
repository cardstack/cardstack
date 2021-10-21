import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import PrepaidCardColorSchemeSerializer from './prepaid-card-color-scheme-serializer';
import PrepaidCardPatternSerializer from './prepaid-card-pattern-serializer';

interface PrepaidCardCustomization {
  id: string;
  issuerName: string;
  ownerAddress: string;
  colorSchemeId: string;
  patternId: string;
}
interface PrepaidCardCustomizationSerializationOptions {
  include: PrepaidCardCustomizationRelationship[];
}
interface JSONAPIDocument {
  data: any;
  included?: any[];
}
type PrepaidCardCustomizationRelationship = 'colorScheme' | 'pattern';

export default class PrepaidCardCustomizationSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  prepaidCardColorSchemeSerializer: PrepaidCardColorSchemeSerializer = inject('prepaid-card-color-scheme-serializer', {
    as: 'prepaidCardColorSchemeSerializer',
  });
  prepaidCardPatternSerializer: PrepaidCardPatternSerializer = inject('prepaid-card-pattern-serializer', {
    as: 'prepaidCardPatternSerializer',
  });

  async serialize(id: string, options: Partial<PrepaidCardCustomizationSerializationOptions>): Promise<JSONAPIDocument>;
  async serialize(
    model: PrepaidCardCustomization,
    options: Partial<PrepaidCardCustomizationSerializationOptions>
  ): Promise<JSONAPIDocument>;
  async serialize(
    content: string | PrepaidCardCustomization,
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

  async loadPrepaidCardCustomization(id: string): Promise<PrepaidCardCustomization> {
    let db = await this.databaseManager.getClient();
    let queryResult = await db.query(
      'SELECT id, issuer_name, owner_address, pattern_id, color_scheme_id from prepaid_card_customizations WHERE id = $1',
      [id]
    );
    if (queryResult.rowCount === 0) {
      return Promise.reject(new Error(`No prepaid_card_customization record found with id ${id}`));
    }
    let row = queryResult.rows[0];
    return {
      id: row['id'],
      issuerName: row['issuer_name'],
      ownerAddress: row['owner_address'],
      patternId: row['pattern_id'],
      colorSchemeId: row['color_scheme_id'],
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-customization-serializer': PrepaidCardCustomizationSerializer;
  }
}
