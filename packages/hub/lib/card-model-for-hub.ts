import { SerializerMap } from '@cardstack/core/src/interfaces';
import BaseCardModel, { CardModelConstructor } from '@cardstack/core/src/card-model';

const CardModelForHub: CardModelConstructor = class CardModelForHub extends BaseCardModel {
  // TODO The serializer can move into schema instance during
  // compilation, so that eventually this implementation can go away
  protected get serializerMap(): SerializerMap {
    if (!this.componentMeta) {
      throw new Error(`bug: CardModelForHub has no componentMeta`);
    }
    return this.componentMeta.serializerMap;
  }
};
export default CardModelForHub;
