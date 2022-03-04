import { CardModel, SerializerMap, CardComponentMetaModule } from '@cardstack/core/src/interfaces';
import BaseCardModel from '@cardstack/core/src/card-model';

export default class CardModelForHub extends BaseCardModel implements CardModel {
  async editable(): Promise<CardModel> {
    throw new Error('Hub does not have use of editable');
  }

  async component(): Promise<unknown> {
    throw new Error('Hub does not have use of component');
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
}
