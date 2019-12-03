import CardstackError from "./error";
import { loadWriter, patch } from "./scaffolding";
import { WriterFactory } from "./writer";
import {
  PristineDocument,
  UpstreamDocument,
  UpstreamIdentity
} from "./document";
import { SingleResourceDoc } from "jsonapi-typescript";
import cloneDeep from 'lodash/cloneDeep';


export class Card {
  // Almost everyone should treat this as opaque and only valid on the current
  // hub. (The only exception is some code within the hub itself that may
  // optimize by pulling these apart.)
  get id(): string | undefined {
    if (typeof this.localId === 'string') {
      return [this.realm.href, this.originalRealm.href, this.localId].map(encodeURIComponent).join('/');
    }
    return undefined;
  }

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

  constructor(jsonapi: SingleResourceDoc, realm: URL) {
    this.jsonapi = jsonapi;
    this.realm = realm;
    this.originalRealm =
      typeof jsonapi.data.attributes?.["original-realm"] === "string"
        ? new URL(jsonapi.data.attributes["original-realm"])
        : realm;

    if (typeof jsonapi.data.attributes?.["local-id"] === "string") {
      this.localId = jsonapi.data.attributes?.["local-id"];
    }
  }

  async asPristineDoc(): Promise<PristineDocument> {
    let copied = cloneDeep(this.jsonapi);
    if (!copied.data.attributes) {
      copied.data.attributes = {};
    }
    copied.data.attributes.realm = this.realm.href;
    copied.data.attributes['original-realm'] = this.originalRealm.href;
    if (this.localId) {
      copied.data.attributes['local-id'] = this.localId;
    }
    copied.data.id =this.id;
    return new PristineDocument(copied);
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(this.jsonapi);
  }

  assertHasIds(): asserts this is CardWithId {
    cardHasIds(this);
  }

  patch(otherDoc: SingleResourceDoc): void {
    patch(this.jsonapi, otherDoc);
  }

  // This is the way that data source plugins think about card IDs. The
  // upstreamId is only unique *within* a realm.
  get upstreamId(): UpstreamIdentity | null {
    if (this.realm.href === this.originalRealm.href) {
      if (typeof this.localId === "string") {
        return this.localId;
      } else {
        return null;
      }
    } else {
      if (typeof this.localId === "string") {
        return { originalRealm: this.originalRealm, localId: this.localId };
      } else {
        throw new CardstackError(
          `A card originally from a different realm must already have a local-id`,
          { status: 400 }
        );
      }
    }
  }
}

function cardHasIds(card: Card): asserts card is CardWithId {
  if (typeof card.localId !== "string") {
    throw new CardstackError(`card missing required attribute "localId"`);
  }
}

export class CardWithId extends Card {
  id!: string;
  localId!: string;

  constructor(jsonapi: SingleResourceDoc) {
    if (typeof jsonapi.data.attributes?.realm !== "string") {
      throw new CardstackError(
        `card missing required attribute "realm": ${JSON.stringify(jsonapi)}`
      );
    }
    let realm = new URL(jsonapi.data.attributes.realm);
    super(jsonapi, realm);
    cardHasIds(this);
  }

  async loadFeature(featureName: "writer"): Promise<WriterFactory | null>;
  async loadFeature(_featureName: any): Promise<any> {
    return await loadWriter(this);
  }
}

export interface CardId {
  realm: URL;
  originalRealm?: URL; // if not set, its implied that its equal to `realm`.
  localId: string;
}
