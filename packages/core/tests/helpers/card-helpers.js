import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment'
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
      if (linkage == null || (Array.isArray(linkage) && !linkage.length)) {
        delete resource.relationships[field];
      }
    }
    delete resource.meta;
  }
  return document;
}

export async function getCard(id) {
  let url = `${hubURL}/api/cards/${id}`;
  let response = await fetch(url, {
    headers: {
      authorization: `Bearer ${ciSessionId}`,
      "content-type": 'application/vnd.api+json'
    }
  });
  return (await response.json());
}

export async function updateCard(id, card) {
  let url = `${hubURL}/api/cards/${id}`;
  let response = await fetch(url, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${ciSessionId}`,
      "content-type": 'application/vnd.api+json'
    },
    body: JSON.stringify(card)
  });
  return (await response.json());

}