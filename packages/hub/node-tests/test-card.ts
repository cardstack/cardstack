import { SingleResourceDoc } from 'jsonapi-typescript';

export class TestCard {
  constructor(private cardAttrs: CardAttrs, private modelAttrs: ModelAttrs) {}

  get jsonapi(): SingleResourceDoc {
    let doc = {
      data: {
        type: 'cards',
        attributes: {
          model: {
            attributes: this.modelAttrs,
          },
        } as NonNullable<SingleResourceDoc['data']['attributes']>,
      },
    };
    if (this.cardAttrs.localId) {
      doc.data.attributes['local-id'] = this.cardAttrs.localId;
    }

    if (this.cardAttrs.realm) {
      doc.data.attributes.realm = this.cardAttrs.realm;
    }

    if (this.cardAttrs.originalRealm) {
      doc.data.attributes['original-realm'] = this.cardAttrs.originalRealm;
    }

    return doc;
  }
}

interface ModelAttrs {
  [fieldName: string]: any;
}
interface CardAttrs {
  realm?: string;
  originalRealm?: string;
  localId?: string;
}

export function testCard(modelAttrs: ModelAttrs): TestCard;
export function testCard(cardAttrs: CardAttrs, modelAttrs: ModelAttrs): TestCard;
export function testCard(first: CardAttrs | ModelAttrs, second?: ModelAttrs): TestCard {
  let card: CardAttrs | undefined;
  let model: ModelAttrs;
  if (second) {
    card = first as CardAttrs;
    model = second;
  } else {
    card = {};
    model = first;
  }
  return new TestCard(card, model);
}
