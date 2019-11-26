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
  ResourceIdentifierObject
} from "jsonapi-typescript";

export class PristineDocument {
  kind = "pristine";
  constructor(public jsonapi: SingleResourceDoc) {}
}

export class UpstreamDocument {
  kind = "upstream";
  constructor(public jsonapi: SingleResourceDoc) {}
}

export class SearchDocument {
  kind = "search";
  constructor(public jsonapi: SingleResourceDoc) {}
}

export function isSingleResourceDoc(body: any): body is SingleResourceDoc {
  if (typeof body !== "object" || body == null) {
    return false;
  }

  if (!isResourceObject(body.data)) {
    return false;
  }

  if (body.hasOwnProperty("included")) {
    let included = body.included;
    if (!Array.isArray(included)) {
      return false;
    }
    if (!included.every(isResourceObject)) {
      return false;
    }
  }

  if (body.hasOwnProperty("jsonapi") && !isImplementationInfo(body.jsonapi)) {
    return false;
  }

  if (
    body.hasOwnProperty("links") &&
    !isLinks(body.links) &&
    !isPaginationLinks(body.links)
  ) {
    return false;
  }

  if (body.hasOwnProperty("meta") && !isMetaObject(body.meta)) {
    return false;
  }

  return true;
}

function isResourceObject(obj: any): obj is ResourceObject {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }

  if (obj.hasOwnProperty("id") && typeof obj.id !== "string") {
    return false;
  }

  if (typeof obj.type !== "string") {
    return false;
  }

  if (obj.hasOwnProperty("attributes") && !isAttributesObject(obj.attributes)) {
    return false;
  }

  if (
    obj.hasOwnProperty("relationships") &&
    !isRelationshipsObject(obj.attributes)
  ) {
    return false;
  }

  if (obj.hasOwnProperty("links") && !isLinks(obj.links)) {
    return false;
  }

  if (obj.hasOwnProperty("meta") && !isMetaObject(obj.meta)) {
    return false;
  }

  return true;
}

function isAttributesObject(obj: any): obj is AttributesObject {
  return Object.values(obj).every(isJSONValue);
}

function isJSONValue(v: any): boolean {
  if (v === null) {
    return true;
  }
  switch (typeof v) {
    case "string":
    case "number":
    case "boolean":
      return true;
    case "object":
      if (Array.isArray(v)) {
        return v.every(isJSONValue);
      } else {
        return Object.values(v).every(isJSONValue);
      }
  }
  return false;
}

function isMetaObject(obj: any): obj is MetaObject {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  return Object.values(obj).every(isJSONValue);
}

function isLinks(obj: any): obj is Links {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  if (obj.hasOwnProperty("self") && !isLink(obj.self)) {
    return false;
  }
  if (obj.hasOwnProperty("related") && !isLink(obj.related)) {
    return false;
  }
  return true;
}

function isLink(obj: any): obj is Link {
  if (typeof obj === "string") {
    return true;
  }
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  if (typeof obj.href !== "string") {
    return false;
  }
  if (obj.hasOwnProperty("meta") && !isMetaObject(obj.meta)) {
    return false;
  }
  return true;
}

function isPaginationLinks(obj: any): obj is PaginationLinks {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  return ["first", "last", "prev", "next"].every(
    field => !obj.hasOwnproperty(field) || obj[field] === null || isLink(obj[field])
  );
}

function isImplementationInfo(obj: any): obj is ImplementationInfo {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  if (obj.hasOwnProperty("meta") && !isMetaObject(obj.meta)) {
    return false;
  }
  if (obj.hasOwnProperty('version') && typeof obj.version !== 'string') {
    return false;
  }
  return true;
}

function isRelationshipsObject(obj: any): obj is RelationshipsObject {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  return obj.values().every(isRelationshipObject);
}

function isRelationshipObject(obj: any): obj is RelationshipObject {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }

  if (!['meta', 'data', 'links'].some(field => obj.hasOwnProperty(field))) {
    return false;
  }

  if (obj.hasOwnProperty("meta") && !isMetaObject(obj.meta)) {
    return false;
  }

  if (obj.hasOwnProperty("data") && !isResourceLinkage(obj.data)) {
    return false;
  }

  if (obj.hasOwnProperty("links") && !isLinks(obj.links)) {
    return false;
  }
  return true;
}

function isResourceLinkage(obj: any): obj is ResourceLinkage {
  if (obj === null) {
    return true;
  }
  if (Array.isArray(obj)) {
    return obj.every(isResourceIdentifierObject);
  } else {
    return isResourceIdentifierObject(obj);
  }
}

function isResourceIdentifierObject(obj: any): obj is ResourceIdentifierObject {
  if (typeof obj !== "object" || obj == null) {
    return false;
  }
  if (obj.hasOwnProperty("meta") && !isMetaObject(obj.meta)) {
    return false;
  }
  if (typeof obj.type !== "string") {
    return false;
  }
  if (typeof obj.id !== "string") {
    return false;
  }
  return true;
}
