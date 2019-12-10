import { CardWithId } from './card';
import { PristineCollection } from './document';

export default class CardCollection {
  constructor(private cards: CardWithId[]) {}

  async asPristineDoc(): Promise<PristineCollection> {
    let pristineDocs = await Promise.all(this.cards.map(card => card.asPristineDoc()));
    return new PristineCollection({
      data: pristineDocs.map(doc => doc.jsonapi.data),
    });
  }
}
