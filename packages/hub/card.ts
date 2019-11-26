import CardstackError from "./error";
import { loadWriter } from "./scaffolding";
import { WriterFactory } from "./writer";
import { PristineDocument, UpstreamDocument } from "./document";
import { SingleResourceDoc } from "jsonapi-typescript";

export class NewCard {
  // The id is an entirely synthetic primary key that is only relevant on the
  // current hub. When establishing ard identity across hubs, we always work
  // with realm, originalRealm, and localId instead.
  id: string | undefined;

  // This is the realm the card is stored in.
  realm: URL;

  // this is the realm the card was first created in. As a card is copied to
  // other realms, `card.realm` changes but `card.originalRealm` does not.
  originalRealm: URL;

  // the localId distinguishes the card within its originalRealm. In some cases
  // it may be chosen by the person creating the card. In others it may be
  // chosen by the hub.
  localId: string | undefined;

  private jsonapi: SingleResourceDoc;

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

  constructor(public doc: PristineDocument, realm: URL) {
    let jsonapi = doc.jsonapi;
    this.jsonapi = jsonapi;
    this.id = jsonapi.data.id;
    this.realm = realm;
    this.originalRealm =
      typeof jsonapi.data.attributes?.["original-realm"] === "string"
        ? new URL(jsonapi.data.attributes["original-realm"])
        : realm;


    if (typeof jsonapi.data.attributes?.['local-id'] === 'string') {
      this.localId = jsonapi.data.attributes?.["local-id"];
    }
  }

  async asPristineDoc(): Promise<PristineDocument> {
    let copied = JSON.parse(JSON.stringify(this.jsonapi)) as SingleResourceDoc;
    if (!copied.data.attributes) {
      copied.data.attributes = {};
    }
    copied.data.attributes.realm = this.realm.href;
    copied.data.attributes['original-realm'] = this.originalRealm.href;
    if (!copied.data.id) {
      copied.data.id = String(Math.floor(Math.random() * 1000));
    }

    if (!copied.data.attributes['local-id']) {
      copied.data.attributes['local-id'] = copied.data.id;
    }

    return new PristineDocument(copied);
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(this.jsonapi);
  }
}

export default class Card extends NewCard {
  id!: string;
  localId!: string;

  constructor(doc: PristineDocument) {
    if (typeof doc.jsonapi.data.attributes?.realm !== "string") {
      throw new CardstackError(
        `card missing required attribute "realm": ${JSON.stringify(
          doc.jsonapi
        )}`
      );
    }
    let realm = new URL(doc.jsonapi.data.attributes.realm);
    super(doc, realm);
    if (typeof this.id !== 'string') {
      throw new CardstackError(`card missing required attribute "id"`);
    }
    if (typeof this.localId !== "string") {
      throw new CardstackError(
        `card missing required attribute "localId"`
      );
    }
  }

  async loadFeature(featureName: "writer"): Promise<WriterFactory>;
  async loadFeature(_featureName: any): Promise<any> {
    return await loadWriter(this);
  }
}

export interface CardId {
  realm: URL;
  originalRealm?: URL; // if not set, its implied that its equal to `realm`.
  localId: string;
}
