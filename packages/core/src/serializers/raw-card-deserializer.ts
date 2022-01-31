import { assertValidRawCard, CompiledCard, Field, RawCard } from '../interfaces';
import { findIncluded } from './index';

export class RawCardDeserializer {
  private shared = new Map<string, CompiledCard>();

  deserialize(
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
    if (!attrs) {
      throw new Error('invalid raw-card jsonapi: missing attributes');
    }
    let raw: RawCard = {
      realm: attrs.realm,
      id: resource.id.slice(attrs.realm.length),
    };

    let fields: (keyof RawCard)[] = [
      'schema',
      'isolated',
      'embedded',
      'edit',
      'deserializer',
      'adoptsFrom',
      'files',
      'data',
    ];
    for (let field of fields) {
      if (attrs[field] != null) {
        raw[field] = attrs[field];
      }
    }

    assertValidRawCard(raw);
    let metaRef = resource.relationships?.compiledMeta?.data;
    let compiled: CompiledCard | undefined;
    if (metaRef) {
      compiled = this.shared.get(metaRef.id);
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
      realm: attrs?.realm,
      schemaModule: attrs?.schemaModule,
      serializer: attrs?.serializer,
      isolated: attrs?.isolated,
      embedded: attrs?.embedded,
      edit: attrs?.edit,
      fields: {},
      modules: attrs?.modules,
      deps: attrs?.deps,
    };
    this.shared.set(compiled.url, compiled);

    let parentRef = resource.relationships?.adoptsFrom?.data;
    if (parentRef) {
      let cached = this.shared.get(parentRef.id);
      if (cached) {
        compiled.adoptsFrom = cached;
      } else {
        let parentResource = findIncluded(doc, parentRef);
        if (parentResource) {
          compiled.adoptsFrom = this.deserializeCompiledMeta(parentResource, doc);
        }
      }
    }

    let fieldRefs = resource.relationships?.fields?.data;
    if (fieldRefs) {
      for (let fieldRef of fieldRefs) {
        let fieldResource = findIncluded(doc, fieldRef);
        if (fieldResource) {
          let field = this.deserializeField(fieldResource, doc);
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
      card = this.shared.get(cardRef.id);
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
      computed: attrs?.computed,
      card,
    };
    return field;
  }
}
