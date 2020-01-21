import {
  SingleResourceDoc,
  ResourceObject,
  AttributesObject,
  MetaObject,
  Links,
  Link,
  PaginationLinks,
  ImplementationInfo,
  RelationshipObject,
  RelationshipsObject,
  ResourceLinkage,
  ResourceIdentifierObject,
  CollectionResourceDoc,
  Included,
} from 'jsonapi-typescript';
import intersection from 'lodash/intersection';
import CardstackError from './error';
import { assertJSONValue } from './json-validation';

export function assertCollectionResourceDoc(
  body: any,
  pointer: string[] = ['']
): asserts body is CollectionResourceDoc {
  if (typeof body !== 'object' || body == null) {
    throw new CardstackError('missing json document', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  let data = body.data;
  if (!Array.isArray(data)) {
    throw new CardstackError('body data must be an array', {
      source: { pointer: pointer.concat('data').join('/') },
      status: 400,
    });
  }
  data.every((r, index) => assertResourceObject(r, pointer.concat(['data', `[${index}]`])));

  if (body.hasOwnProperty('included')) {
    assertIncluded(body.included, pointer.concat('included'));
  }

  assertDocBase(body, pointer);
}

export function assertSingleResourceDoc(body: any, pointer: string[] = ['']): asserts body is SingleResourceDoc {
  if (typeof body !== 'object' || body == null) {
    throw new CardstackError('missing json document', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  assertResourceObject(body.data, pointer.concat('data'));

  if (body.hasOwnProperty('included')) {
    assertIncluded(body.included, pointer.concat('included'));
  }
  assertDocBase(body, pointer);
}

function assertIncluded(included: any, pointer: string[]): asserts included is Included {
  if (!Array.isArray(included)) {
    throw new CardstackError('included must be an array', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  included.every((r, index) => assertResourceObject(r, pointer.concat(`[${index}]`)));
}

function assertDocBase(body: any, pointer: string[]) {
  if (body.hasOwnProperty('jsonapi')) {
    assertImplementationInfo(body.jsonapi, pointer.concat('jsonapi'));
  }

  if (body.hasOwnProperty('links')) {
    let linksPointer = pointer.concat('links');
    try {
      assertLinks(body.links, linksPointer);
    } catch (err) {
      if (!err.isCardstackError) {
        throw err;
      }
      try {
        assertPaginationLinks(body.links, linksPointer);
      } catch (paginationError) {
        let e = new CardstackError(`resource-level links object is invalid`, {
          source: { pointer: linksPointer.join('/') },
          status: 400,
        });
        e.additionalErrors = [err, paginationError];
        throw e;
      }
    }
  }

  if (body.hasOwnProperty('meta')) {
    assertMetaObject(body.meta, pointer.concat('meta'));
  }
}

function assertResourceObject(obj: any, pointer: string[]): asserts obj is ResourceObject {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('missing resource object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }

  if (obj.hasOwnProperty('id') && typeof obj.id !== 'string') {
    throw new CardstackError('id is not a string', {
      source: { pointer: pointer.concat('id').join('/') },
      status: 400,
    });
  }

  if (typeof obj.type !== 'string') {
    throw new CardstackError('type must be a string', {
      source: { pointer: pointer.concat('type').join('/') },
      status: 400,
    });
  }

  if (obj.hasOwnProperty('attributes')) {
    assertAttributesObject(obj.attributes, pointer.concat('attributes'));
  }

  if (obj.hasOwnProperty('relationships')) {
    assertRelationshipsObject(obj.relationships, pointer.concat('relationships'));
  }

  if (obj.hasOwnProperty('attributes') && obj.hasOwnProperty('relationships')) {
    let dupeFields = intersection(Object.keys(obj.attributes), Object.keys(obj.relationships));
    if (dupeFields.length) {
      throw new CardstackError(
        `The field${dupeFields.length > 1 ? 's' : ''} ${dupeFields.join(
          ','
        )} cannot appear in both the relationships and attributes of a resource.`,
        {
          source: { pointer: pointer.concat(['attributes', dupeFields[0]]).join('/') },
          status: 400,
        }
      );
    }
  }

  if (obj.hasOwnProperty('links')) {
    assertLinks(obj.links, pointer.concat('links'));
  }

  if (obj.hasOwnProperty('meta')) {
    assertMetaObject(obj.meta, pointer.concat('meta'));
  }
}

function assertAttributesObject(obj: any, pointer: string[]): asserts obj is AttributesObject {
  Object.entries(obj).every(([key, value]) => assertJSONValue(value, pointer.concat(key)));
}

function assertMetaObject(obj: any, pointer: string[]): asserts obj is MetaObject {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('meta must be an object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  Object.entries(obj).every(([key, value]) => assertJSONValue(value, pointer.concat(key)));
}

function assertLinks(obj: any, pointer: string[]): asserts obj is Links {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('links must be an object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  if (obj.hasOwnProperty('self')) {
    assertLink(obj.self, pointer.concat('self'));
  }
  if (obj.hasOwnProperty('related')) {
    assertLink(obj.related, pointer.concat('related'));
  }
}

function assertLink(obj: any, pointer: string[]): asserts obj is Link {
  if (typeof obj === 'string') {
    return;
  }
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('link is not a string or object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  if (typeof obj.href !== 'string') {
    throw new CardstackError('href is not a string', {
      source: { pointer: pointer.concat('href').join('/') },
      status: 400,
    });
  }
  if (obj.hasOwnProperty('meta')) {
    assertMetaObject(obj.meta, pointer.concat('meta'));
  }
}

function assertPaginationLinks(obj: any, pointer: string[]): asserts obj is PaginationLinks {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('links is not an object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  ['first', 'last', 'prev', 'next'].every(
    field => !obj.hasOwnproperty(field) || obj[field] === null || assertLink(obj[field], pointer.concat(field))
  );
}

function assertImplementationInfo(obj: any, pointer: string[]): asserts obj is ImplementationInfo {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('JSON:API Object must be an object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  if (obj.hasOwnProperty('meta')) {
    assertMetaObject(obj.meta, pointer.concat('meta'));
  }
  if (obj.hasOwnProperty('version') && typeof obj.version !== 'string') {
    throw new CardstackError('version must be a string', {
      source: { pointer: pointer.concat('version').join('/') },
      status: 400,
    });
  }
}

function assertRelationshipsObject(obj: any, pointer: string[]): asserts obj is RelationshipsObject {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('relationships must be an object', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  Object.entries(obj).every(([key, value]) => assertRelationshipObject(value, pointer.concat(key)));
}

function assertRelationshipObject(obj: any, pointer: string[]): asserts obj is RelationshipObject {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('relationship must be an object or null', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }

  if (!['meta', 'data', 'links'].some(field => obj.hasOwnProperty(field))) {
    throw new CardstackError('relationship must have at least one of: meta, data, links', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }

  if (obj.hasOwnProperty('meta')) {
    assertMetaObject(obj.meta, pointer.concat('meta'));
  }

  if (obj.hasOwnProperty('data')) {
    assertResourceLinkage(obj.data, pointer.concat('data'));
  }

  if (obj.hasOwnProperty('links')) {
    assertLinks(obj.links, pointer.concat('links'));
  }
}

function assertResourceLinkage(obj: any, pointer: string[]): asserts obj is ResourceLinkage {
  if (obj === null) {
    return;
  }
  if (Array.isArray(obj)) {
    obj.every((value, index) => assertResourceIdentifierObject(value, pointer.concat(`[${index}]`)));
  } else {
    assertResourceIdentifierObject(obj, pointer);
  }
}

function assertResourceIdentifierObject(obj: any, pointer: string[]): asserts obj is ResourceIdentifierObject {
  if (typeof obj !== 'object' || obj == null) {
    throw new CardstackError('resource identifier must be an object or null', {
      source: { pointer: pointer.join('/') },
      status: 400,
    });
  }
  if (obj.hasOwnProperty('meta')) {
    assertMetaObject(obj.meta, pointer.concat('meta'));
  }
  if (typeof obj.type !== 'string') {
    throw new CardstackError('type must be a string', {
      source: { pointer: pointer.concat('type').join('/') },
      status: 400,
    });
  }
  if (typeof obj.id !== 'string') {
    throw new CardstackError('id must be a string', {
      source: { pointer: pointer.concat('id').join('/') },
      status: 400,
    });
  }
}
