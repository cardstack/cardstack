import { CardModel, SerializerMap, RawCardData, CardComponentMetaModule } from '@cardstack/core/src/interfaces';
import BaseCardModel from '@cardstack/core/src/card-model';
import { serializeAttributes } from '@cardstack/core/src/serializers';
import merge from 'lodash/merge';
import isPlainObject from 'lodash/isPlainObject';
import { BadRequest } from '@cardstack/core/src/utils/errors';

export default class CardModelForHub extends BaseCardModel implements CardModel {
  setters: undefined;

  async editable(): Promise<CardModel> {
    throw new Error('Hub does not have use of editable');
  }

  // TODO in the future when we do SSR, we'll have a need for this
  async component(): Promise<unknown> {
    throw new Error('Hub does not have use of component');
  }

  // TODO refactor to use CardModelForBrowser's setter
  async setData(data: RawCardData): Promise<void> {
    let nonExistentFields = this.assertFieldsExists(data);
    if (nonExistentFields.length) {
      throw new BadRequest(
        `the field(s) ${nonExistentFields.map((f) => `'${f}'`).join(', ')} are not allowed to be set for the card ${
          this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
        } in format '${this.format}'`
      );
    }

    this.rawData = serializeAttributes(merge({}, this.rawData, data), this.serializerMap);
    let newSchemaInstance = await this.createSchemaInstance();
    await this.computeData(newSchemaInstance);
    this._schemaInstance = newSchemaInstance;
  }

  protected get serializerMap(): SerializerMap {
    if (!this.componentMeta) {
      throw new Error(`bug: CardModelForHub has no componentMeta`);
    }
    return this.componentMeta.serializerMap;
  }

  protected get usedFields(): CardComponentMetaModule['usedFields'] {
    if (!this.componentMeta) {
      throw new Error(`bug: CardModelForHub has no componentMeta`);
    }
    return this.componentMeta.usedFields;
  }

  protected get allFields(): CardComponentMetaModule['allFields'] {
    if (!this.componentMeta) {
      throw new Error(`bug: CardModelForHub has no componentMeta`);
    }
    return this.componentMeta.allFields;
  }

  protected componentModule() {
    return Promise.resolve();
  }

  // TODO: we need to really use a validation mechanism which will use code from
  // the schema.js module to validate the fields
  private assertFieldsExists(data: RawCardData, path = ''): string[] {
    let nonExistentFields: string[] = [];
    for (let [field, value] of Object.entries(data)) {
      let fieldPath = path ? `${path}.${field}` : field;
      if (isPlainObject(value)) {
        nonExistentFields = [...nonExistentFields, ...this.assertFieldsExists(value, fieldPath)];
      } else if (!this.usedFields.includes(fieldPath)) {
        nonExistentFields.push(fieldPath);
      }
    }
    return nonExistentFields;
  }
}
