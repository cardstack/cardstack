import * as JSON from 'json-typescript';
import { RawCard, CompiledCard, Field } from './interfaces';
import { serializeResource, findIncluded } from './utils/jsonapi';

export class RawCardSerializer {
  doc: any;

  serialize(card: RawCard, compiled?: CompiledCard): JSON.Object {
    let resource = serializeResource(
      'raw-cards',
      `${card.realm}${card.id}`,
      ['schema', 'isolated', 'embedded', 'edit', 'deserializer', 'adoptsFrom', 'files', 'data', 'realm'],
      card
    );

    this.doc = { data: resource };

    if (compiled) {
      this.doc.included = [];
      resource.relationships = {
        compiledMeta: { data: this.includeCompiledMeta(compiled) },
      };
    }
    return this.doc;
  }

  private includeCompiledMeta(compiled: CompiledCard) {
    if (!findIncluded(this.doc, { type: 'compiled-metas', id: compiled.url })) {
      let resource = serializeResource(
        'compiled-metas',
        compiled.url,
        ['schemaModule', 'serializer', 'isolated', 'embedded', 'edit'],
        compiled
      );
      this.doc.included.push(resource);

      resource.relationships ||= {};
      if (compiled.adoptsFrom) {
        resource.relationships.adoptsFrom = {
          data: this.includeCompiledMeta(compiled.adoptsFrom),
        };
      }
      resource.relationships.fields = {
        data: Object.values(compiled.fields).map((field) => this.includeField(compiled, field)),
      };
    }

    return { type: 'compiled-metas', id: compiled.url };
  }

  private includeField(parent: CompiledCard, field: Field) {
    let id = `${parent.url}/${field.name}`;
    if (!findIncluded(this.doc, { type: 'fields', id })) {
      let resource = serializeResource('fields', id, ['name', { fieldType: 'type' }], field);
      resource.relationships ||= {};
      resource.relationships.card = {
        data: this.includeCompiledMeta(field.card),
      };
      this.doc.included.push(resource);
    }
    return { type: 'fields', id };
  }
}
