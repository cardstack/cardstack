import type {
  CardJSONResponse,
  CompiledCard,
  Field,
  Format,
  RawCard,
} from '@cardstack/core/src/interfaces';
import Builder from './builder';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';

const { cardServer } = config as any; // Environment types arent working

// this might want to get renamed to something more generic like "Editor" or
// "Creator" because it encompasses all API for manipulating cards at the source
// code level, whether or not you're storing them in an in-browser local realm.
export default class LocalRealm {
  private rawCards = new Map<string, RawCard>();
  private builder: Builder;

  // cache of raw cards that we loaded from the server (because we needed them
  // as dependencies)
  private remoteRawCards = new Map<string, RawCard>();

  // cache of compiled cards that we loaded from the server (because we needed
  // them as dependencies)
  private remoteCompiledCards = new Map<string, CompiledCard>();

  constructor(private ownRealmURL: string) {
    this.builder = new Builder(this, ownRealmURL);
  }

  async load(url: string, format: Format): Promise<CardJSONResponse> {
    let raw = await this.builder.getRawCard(url);
    let compiled = await this.builder.getCompiledCard(url);

    // TODO: reduce data shape for the given format like we do on the server
    return {
      data: {
        type: 'card',
        id: url,
        attributes: raw.data, // TODO: I'm assuming everything in here is only attributes
        meta: {
          componentModule: compiled[format].moduleName,
        },
      },
    };
  }

  async createRawCard(rawCard: RawCard): Promise<void> {
    if (this.inOwnRealm(rawCard.url)) {
      this.rawCards.set(rawCard.url, rawCard);
    } else {
      throw new Error('unimplemented');
    }
  }

  async getRawCard(url: string): Promise<RawCard> {
    if (this.inOwnRealm(url)) {
      let card = this.rawCards.get(url);
      if (!card) {
        throw new Error(`${url} not found in local realm`);
      }
      return card;
    } else {
      let cached = this.remoteRawCards.get(url);
      if (cached) {
        return cached;
      } else {
        let response = await fetchJSON<any>(
          [cardServer, 'sources/', encodeURIComponent(url)].join('')
        );
        return this.deserializeRawCard(response.data, response).raw;
      }
    }
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    if (this.inOwnRealm(url)) {
      return await this.builder.getCompiledCard(url);
    } else {
      let cached = this.remoteCompiledCards.get(url);
      if (cached) {
        return cached;
      }
      let response = await fetchJSON<any>(
        [
          cardServer,
          'sources/',
          encodeURIComponent(url),
          '?include=compiledMeta',
        ].join('')
      );

      let { compiled } = this.deserializeRawCard(response.data, response);
      if (!compiled) {
        throw new Error(`expected to find compiled meta alongside raw card`);
      }
      return compiled;
    }
  }

  private inOwnRealm(cardURL: string): boolean {
    return cardURL.startsWith(this.ownRealmURL);
  }

  private deserializeRawCard(
    resource: any,
    doc: any
  ): {
    raw: RawCard;
    compiled: CompiledCard | undefined;
  } {
    if (resource.type !== 'raw-cards') {
      throw new Error(`expected type raw-cards, got ${resource.type}`);
    }
    let { attributes: attrs } = resource;
    let raw: RawCard = {
      url: resource.id,
      schema: attrs?.schema,
      isolated: attrs?.isolated,
      embedded: attrs?.embedded,
      edit: attrs?.edit,
      deserializer: attrs?.deserializer,
      adoptsFrom: attrs?.adoptsFrom,
      files: attrs?.files,
      data: attrs?.data,
    };
    this.remoteRawCards.set(raw.url, raw);
    let metaRef = resource.relationships?.compiledMeta?.data;
    let compiled: CompiledCard | undefined;
    if (metaRef) {
      compiled = this.remoteCompiledCards.get(metaRef.id);
      if (!compiled) {
        let metaResource = findIncluded(doc, metaRef);
        if (metaRef) {
          compiled = this.deserializeCompiledMeta(metaResource, doc);
        }
      }
    }
    return { raw, compiled };
  }

  private deserializeCompiledMeta(resource: any, doc: any): CompiledCard {
    if (resource.type !== 'compiled-metas') {
      throw new Error(`expected type compiled-metas, got ${resource.type}`);
    }
    let { attributes: attrs } = resource;
    let compiled: CompiledCard = {
      url: resource.id,
      schemaModule: attrs?.schemaModule,
      serializer: attrs?.serializer,
      isolated: attrs?.isolated,
      embedded: attrs?.embedded,
      edit: attrs?.edit,
      fields: {},
    };
    this.remoteCompiledCards.set(compiled.url, compiled);

    let parentRef = resource.relationships?.adoptsFrom?.data;
    if (parentRef) {
      let cached = this.remoteCompiledCards.get(parentRef.id);
      if (cached) {
        compiled.adoptsFrom = cached;
      } else {
        let parentResource = findIncluded(doc, parentRef);
        if (parentResource) {
          compiled.adoptsFrom = this.deserializeCompiledMeta(
            parentResource,
            doc
          );
        }
      }
    }

    let fieldRefs = resource.relationships?.fields?.data;
    if (fieldRefs) {
      for (let fieldRef of fieldRefs) {
        let fieldResource = findIncluded(doc, fieldRef);
        if (fieldResource) {
          let field = this.deserializeField(fieldRef, doc);
          compiled.fields[field.name] = field;
        }
      }
    }

    return compiled;
  }

  private deserializeField(resource: any, doc: any): Field {
    if (resource.type !== 'fields') {
      throw new Error(`expected type fields, got ${resource.type}`);
    }
    let card = undefined;
    let cardRef = resource.relationships?.card.data;
    if (cardRef) {
      card = this.remoteCompiledCards.get(cardRef.id);
      if (!card) {
        let cardResource = findIncluded(doc, cardRef);
        if (cardResource) {
          card = this.deserializeCompiledMeta(cardResource, doc);
        }
      }
    }
    if (!card) {
      throw new Error(`bug: field ${resource.id} is missing card relationship`);
    }
    let { attributes: attrs } = resource;
    let field: Field = {
      name: attrs?.name,
      type: attrs?.fieldType,
      card,
    };
    return field;
  }
}

function findIncluded(doc: any, ref: { type: string; id: string }) {
  return doc.included?.find((r: any) => r.id === ref.id && r.type === ref.type);
}
