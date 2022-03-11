import { CardModel, SerializerMap } from '@cardstack/core/src/interfaces';
import BaseCardModel from '@cardstack/core/src/card-model';

export default class CardModelForHub extends BaseCardModel implements CardModel {
  // TODO The serializer can move into schema instance during
  // compilation, so that eventually this implementation can go away
  protected get serializerMap(): SerializerMap {
    if (!this.componentMeta) {
      throw new Error(`bug: CardModelForHub has no componentMeta`);
    }
    return this.componentMeta.serializerMap;
  }
}
