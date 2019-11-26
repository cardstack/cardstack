import { SingleResourceDoc } from "jsonapi-typescript";
import CardstackError from "./error";
import { loadWriter } from "./scaffolding";
import { WriterFactory } from "./writer";

export default class Card {
  // The id is an entirely synthetic primary key that is only relevant on the
  // current hub. When establishing ard identity across hubs, we always work
  // with realm, originalRealm, and localId instead.
  id: string;

  // This is the realm the card is stored in.
  realm: URL;

  // this is the realm the card was first created in. As a card is copied to
  // other realms, `card.realm` changes but `card.originalRealm` does not.
  originalRealm: URL;

  // the localId distinguishes the card within its originalRealm. In some cases
  // it may be chosen by the person creating the card. In others it may be
  // chosen by the hub.
  localId: string;

  // Identity invariants:
  //
  //  - within a given originalRealm, localId is unique.
  //
  //  - [originalRealm, localId] is the globally unique *semantic* identity of a
  //    card. In other words, two Cards with the same [originalRealm, localId]
  //    are "the same card" from the user's perspective, but might be different
  //    "versions" of it, stored in different realms.
  //
  //  - within a given realm, [originalRealm, localId] is unique. That is, we
  //    only allow one version of the same card per realm.
  //
  //  - [realm, originalRealm, id] is globally unique, such that there are
  //    exactly zero or one cards that match it, across all hubs.

  constructor(public jsonapi: SingleResourceDoc) {
    if (typeof jsonapi.data.id !== 'string') {
      throw new CardstackError(`card missing required field "id": ${JSON.stringify(jsonapi)}`);
    }
    this.id = jsonapi.data.id;

    if (typeof jsonapi.data.attributes?.realm !== 'string') {
      throw new CardstackError(`card missing required attribute "realm": ${JSON.stringify(jsonapi)}`);
    }
    this.realm = new URL(jsonapi.data.attributes.realm);

    if (typeof jsonapi.data.attributes?.['original-realm'] !== 'string') {
      throw new CardstackError(`card missing required attribute "originalRealm": ${JSON.stringify(jsonapi)}`);
    }
    this.originalRealm = new URL(jsonapi.data.attributes['original-realm']);

    if (typeof jsonapi.data.attributes?.['local-id'] !== 'string') {
      throw new CardstackError(`card missing required attribute "localId": ${JSON.stringify(jsonapi)}`);
    }
    this.localId = jsonapi.data.attributes['local-id'];
  }

  async loadFeature(featureName: 'writer'): Promise<WriterFactory>
  async loadFeature(_featureName: any): Promise<any> {
    return await loadWriter(this);
  }
}

export interface CardId {
  realm: URL;
  originalRealm?: URL; // if not set, its implied that its equal to `realm`.
  localId: string;
}
