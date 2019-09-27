import { get } from 'lodash';

export function cleanupDefaulValueArtifacts(document) {
  for (let field of Object.keys(document.data.attributes || {})) {
    if (document.data.attributes && document.data.attributes[field] == null) {
      delete document.data.attributes[field];
    }
  }
  for (let resource of document.included || []) {
    for (let field of Object.keys(resource.attributes || {})) {
      if (resource.attributes && resource.attributes[field] == null) {
        delete resource.attributes[field];
      }
    }
    for (let field of Object.keys(resource.relationships || {})) {
      let linkage = get(resource, `relationships.${field}.data`);
      if (linkage == null || !linkage.length) {
        delete resource.relationships[field];
      }
    }
    delete resource.meta;
  }
  return document;
}