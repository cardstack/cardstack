const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const log = require('@cardstack/logger')('cardstack/drupal');

exports.cardstackToDrupalDoc = cardstackToDrupalDoc;
function cardstackToDrupalDoc(doc, schemaModels) {
  let newDoc = {
    id: doc.id,
    type: doc.type
  };

  if (doc.relationships) {
    newDoc.relationships = {};
    for (let [key, value] of Object.entries(doc.relationships)) {
      let field = schemaModels.find(m => m.type === 'fields' && m.id === key);
      if (field && field.meta['drupal-name']) {
        newDoc.relationships[field.meta['drupal-name']] = value;
      } else {
        log.warn("Not writing field %s to Drupal because I don't know about it", key);
      }
    }
  }
  if (doc.attributes) {
    newDoc.attributes = {};
    for (let [key, value] of Object.entries(doc.attributes)) {
      let field = schemaModels.find(m => m.type === 'fields' && m.id === key);
      if (field && field.meta['drupal-name']) {
        newDoc.attributes[field.meta['drupal-name']] = value;
      } else {
        log.warn("Not writing field %s to Drupal because I don't know about it", key);
      }
    }
  }

  if (doc.meta) {
    newDoc.meta = doc.meta;
  }

  return newDoc;
}

exports.drupalToCardstackDoc = drupalToCardstackDoc;
function drupalToCardstackDoc(doc /*, schemaModels */) {
  let newDoc = {
    id: doc.id,
    type: doc.type
  };

  if (doc.relationships) {
    newDoc.relationships = {};
    for (let [key, value] of Object.entries(doc.relationships)) {
      newDoc.relationships[drupalToCardstackField(key)] = value;
    }
  }
  if (doc.attributes) {
    newDoc.attributes = {};
    for (let [key, value] of Object.entries(doc.attributes)) {
      newDoc.attributes[drupalToCardstackField(key)] = value;
    }
  }

  if (doc.meta) {
    newDoc.meta = doc.meta;
  }

  return newDoc;
}

exports.drupalToCardstackField = drupalToCardstackField;
function drupalToCardstackField(fieldName) {
  return dasherize(safePropName(fieldName));
}

function safePropName(drupalName) {
  if (drupalName === 'type' || drupalName === 'id') {
    // See https://www.drupal.org/node/2779963
    return `_drupal_${drupalName}`;
  }
  if (drupalName === 'init') {
    // This is an ember-data limitation: it can't handle an
    // attribute named "init" because that stomps on its own
    // constructor.
    return `_drupal_${drupalName}`;
  }
  return drupalName;
}
