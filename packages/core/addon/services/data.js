import Service from '@ember/service';
import { get, set, uniqBy, cloneDeep } from 'lodash';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

let priv = new WeakMap();
let cache = {
  isolated: new Map(),
  embedded: new Map()
}

export default class DataService extends Service {
  @service cardstackSession;

  async getCard(id, format) {
    if (!['isolated', 'embedded'].includes(format)) { throw new Error(`unknown format specified when getting card '${id}': '${format}'`); }

    if (cache[format].has(id)) {
      return new Card({
        id,
        format,
        session: this.cardstackSession,
        data: await cache[format].get(id)
      });
    } else {
      let card = new Card({
        id,
        format,
        session: this.cardstackSession,
      });
      return await card.load(format);
    }
  }

  createCard(id) {
    return new Card({
      id,
      format: 'isolated',
      isNew: true,
      session: this.cardstackSession
    });
  }

  // used for tests
  _clearCache() {
    cache.isolated = new Map();
    cache.embedded = new Map();
  }
}

// TODO lets create a Field class abstration that wraps the JSONAPI doc used to add a field
class Card {
  constructor({
    id,
    format = 'embedded',
    isNew = false,
    session,
    data
  }) {
    // this keeps our internal state private
    priv.set(this, new CardInternals({
      id,
      isDestroyed: false,
      session,
      isNew,
      format,
      isDirty: isNew || false,
      // This is used to know if the caller needs to .load() the
      // card first (in the case the card was retrieved by
      // following a relationship that is was not included
      // in the related card's document)
      isLoaded: cache[format].has(id),
      embeddedData: (format === 'embedded' ? data : null) ||
        { data: { id, type: 'cards' } },
      isolatedData: (format === 'isolated' ? data : null) ||
        {
          data: {
            id,
            type: 'cards',
            relationships: {
              fields: {
                data: [],
              },
              model: {
                data: { type: id, id }
              }
            }
          },
          included: [
            { id, type: id }
          ]
        }
    }));
  }

  get id() {
    return priv.get(this).id;
  }

  get format() {
    return priv.get(this).format;
  }

  get isNew() {
    return priv.get(this).isNew;
  }

  get isDirty() {
    return priv.get(this).isDirty;
  }

  get isLoaded() {
    return priv.get(this).isLoaded;
  }

  get isDestroyed() {
    return priv.get(this).isDestroyed;
  }

  get json() {
    if (this.isDestroyed) { throw new Error('Cannot get json from destroyed card'); }
    let internal = priv.get(this);
    if (this.format === 'isolated') {
      return cloneDeep(internal.isolatedData);
    } else {
      return cloneDeep(internal.embeddedData);
    }
  }

  setFieldValue(field, value) {
    if (this.isDestroyed) { throw new Error('Cannot setFieldValue from destroyed card'); }
    if (this.format === 'embedded') { throw new Error(`Cannot setFieldValue() on card id '${this.id}' because the card is in the embedded format. Use load('isolated') to get the isolated form of the card before setting field values.`) }

    let internal = priv.get(this);
    let fieldSchema = (internal.isolatedData.included || []).find(i => `${i.type}/${i.id}` === `fields/${field}`);
    if (!fieldSchema) { throw new Error(`Cannot setFieldValue() on non-existent field 'fields/${field}' for card id '${this.id}'.`); }

    let index = internal.isolatedData.included.findIndex(i => `${i.type}/${i.id}` === `${this.id}/${this.id}`);
    let fieldType = get(fieldSchema, 'attributes.field-type');

    // Note that the only kind of relationships that you can fashion are to other cards
    if (fieldType === '@cardstack/core-types::belongs-to') {
      if (value instanceof Card) {
        value = value.id;
      }
      set(internal, `isolatedData.included[${index}].relationships.${field}.data`, { type: 'cards', id: value });
    } else if (fieldType === '@cardstack/core-types::has-many') {
      if (!Array.isArray(value)) { throw new Error(`Cannot set cards relationships on card id '${this.id}' from value '${JSON.stringify(value)}'. The value must be an array of card ID's.`); }

      value = [].concat(value.map(i => i instanceof Card ? i.id : i));
      set(internal, `isolatedData.included[${index}].relationships.${field}.data`, value.map(id => ({ type: 'cards', id })));
    } else {
      set(internal, `isolatedData.included[${index}].attributes.${field}`, value);
    }
    // eslint-disable-next-line no-self-assign
    internal.isolatedData = internal.isolatedData; // oh glimmer, you so silly...
    internal.isDirty = true;
  }

  getFieldValue(field) {
    if (this.isDestroyed) { throw new Error('Cannot getFieldValue from destroyed card'); }
    let value = get(this.json, `data.attributes.${field}`);
    if (value != null) {
      return value;
    }
    let linkage = get(this.json, `data.relationships.${field}.data`);
    let { session } = priv.get(this);
    if (Array.isArray(linkage)) {
      return linkage.filter(i => i.type === 'cards').map(i => {
        let relatedResource = this.json.included.find(j => `${j.type}/${j.id}` === `cards/${i.id}`);
        return new Card({
          id: i.id,
          session: session,
          format: 'embedded',
          data: relatedResource ? { data: relatedResource } : null
        });
      });
    } else if (linkage) {
      let relatedResource = this.json.included.find(i => `${i.type}/${i.id}` === `cards/${linkage.id}`);
      return new Card({
        id: linkage.id,
        session: session,
        format: 'embedded',
        data: relatedResource ? { data: relatedResource } : null
      });
    }
  }

  // TODO this probbaly means adjusting how embedded cards represent their field types
  getFieldType(/*field*/) {
    if (this.isDestroyed) { throw new Error('Cannot getFieldType from destroyed card'); }

  }

  addField(fieldDefinition /*: SingleResourceDocument*/) {
    if (this.isDestroyed) { throw new Error('Cannot addField from destroyed card'); }
    if (this.format === 'embedded') { throw new Error(`Cannot addField() on card id '${this.id}' because the card is in the embedded format. Use load('isolated') to get the isolated form of the card before adding fields.`) }
    if (!fieldDefinition.data) { throw new Error(`'addField()' called for card id '${this.id}' is an invalid JSON:API document--missing 'data' property`); }
    if (!fieldDefinition.data.id) { throw new Error(`'addField()' called for card id '${this.id}' is missing 'id' property`); }
    if (!get(fieldDefinition, 'data.attributes.field-type')) { throw new Error(`'addField()' called for card id '${this.id}' is missing a 'field-type' attribute`); }
    // TODO eventually we need to support computed-fields...
    if (fieldDefinition.data.type !== 'fields') { throw new Error(`'addField()' called for card id '${this.id}' does not have a 'type' of 'fields', Rather it is '${fieldDefinition.data.type}/${fieldDefinition.data.id}'.`); }

    let internal = priv.get(this);
    let id = fieldDefinition.data.id;
    let type = fieldDefinition.data.type;
    let fields = get(internal, 'isolatedData.data.relationships.fields.data');
    if (fields && fields.find(i => `${i.type}/${i.id}` === `${type}/${id}`)) { throw new Error(`'addField() called for card id '${this.id}' to add a new field '${type}/${id}' which already exists for this card.`); }

    if (!fields) {
      fields = [];
      set(internal, 'isolatedData.data.relationships.fields.data', fields);
    }
    fields.push({ type, id });

    let included = internal.isolatedData.included || [];
    included = included.concat([fieldDefinition.data], fieldDefinition.included || []);
    included = uniqBy(included, i => `${i.type}/${i.id}`);
    internal.isolatedData.included = included;
    // eslint-disable-next-line no-self-assign
    internal.isolatedData = internal.isolatedData; // oh glimmer, you so silly...
    internal.isDirty = true;
  }

  removeField(field) {
    if (this.isDestroyed) { throw new Error('Cannot removeField from destroyed card'); }
    if (this.format === 'embedded') { throw new Error(`Cannot removeField() on card id '${this.id}' because the card is in the embedded format. Use load('isolated') to get the isolated form of the card before removing the field.`) }

    let internal = priv.get(this);
    let fieldSchema = (internal.isolatedData.included || []).find(i => `${i.type}/${i.id}` === `fields/${field}`);
    if (!fieldSchema) { throw new Error(`Cannot removeField() on non-existent field 'fields/${field}' for card id '${this.id}'.`); }

    let index = internal.isolatedData.included.findIndex(i => `${i.type}/${i.id}` === `${this.id}/${this.id}`);
    let fieldType = get(fieldSchema, 'attributes.field-type');
    let fields = get(internal, 'isolatedData.data.relationships.fields.data');

    internal.isolatedData.data.relationships.fields.data = fields.filter(i => `${i.type}/${i.id}` !== `fields/${field}`);
    if (fieldType === '@cardstack/core-types::belongs-to' ||
      fieldType === '@cardstack/core-types::has-many') {
      delete internal.isolatedData.included[index].relationships[field];
    } else {
      delete internal.isolatedData.included[index].attributes[field];
    }
    internal.isolatedData.included = (internal.isolatedData.included || {}).filter(i => `${i.type}/${i.id}` !== `fields/${field}`);
    // eslint-disable-next-line no-self-assign
    internal.isolatedData = internal.isolatedData; // oh glimmer, you so silly...
    internal.isDirty = true;
  }

  moveField(/*field, position*/) {
    if (this.isDestroyed) { throw new Error('Cannot moveField from destroyed card'); }
    if (this.format === 'embedded') { throw new Error(`Cannot moveField() on card id '${this.id}' because the card is in the embedded format. Use load('isolated') to get the isolated form of the card before moving the field.`) }
  }

  getAllFields() {
    if (this.isDestroyed) { throw new Error('Cannot getAllFields from destroyed card'); }
    // this returns all the Card's metadata fields in the correct order and the field types so we know how to render them. Perhaps, we just return
    // the JSON:API ResourceObjects for each field to make it simple for now?

    // We also need to think about how to invoke with for an embedded card. it would be nice to not have to make an extra
    // trip over the wire for each embedded card in order to render it--which I think means that the embedded form of a card
    // needs to have enough schema information about it's fields to be able to communicate to the client how to render the field.
  }

  async save() {
    if (this.isDestroyed) { throw new Error('Cannot save from destroyed card'); }
    if (this.format === 'embedded') { throw new Error(`Cannot save card id '${this.id}' because the card is in the embedded format. Use load('isolated') to get the isolated form of the card.`) }
    if (!this.isDirty) { return this; }

    let internal = priv.get(this);
    cache.isolated.set(this.id, this._saveCard());
    internal.isolatedData = await cache.isolated.get(this.id);
    for (let card of (internal.isolatedData.included || []).filter(i => i.type === 'cards')) {
      cache.embedded.set(card.id, new Promise(res => res({ data: card })));
    }

    internal.isNew = false;
    internal.isDirty = false;
    internal.isLoaded = true;

    return this;
  }

  async load(format = 'isolated') {
    if (this.isDestroyed) { throw new Error('Cannot load from destroyed card'); }
    if (!['isolated', 'embedded'].includes(format)) { throw new Error(`unknown format specified in 'load()' for card '${this.id}': '${format}'`); }

    let internal = priv.get(this);
    internal.format = format;
    let response = await fetch(`${hubURL}/api/cards/${this.id}?format=${format}`, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${internal.session.token}`
      },
    });
    if (response.ok) {
      cache[format].set(this.id, response.json());
      if (format === 'isolated') {
        internal.isolatedData = await cache[format].get(this.id);
        for (let card of (internal.isolatedData.included || []).filter(i => i.type === 'cards')) {
          cache.embedded.set(card.id, new Promise(res => res({ data: card })));
        }
      } else {
        internal.embeddedData = await cache[format].get(this.id);
        for (let card of (internal.embeddedData.included || []).filter(i => i.type === 'cards')) {
          cache.embedded.set(card.id, new Promise(res => res({ data: card })));
        }
      }
      internal.isLoaded = true;
      return this;
    } else {
      let error = await response.json();
      throw new Error(`Cannot load card ${response.status}: ${response.statusText}`, error);
    }
  }

  async delete() {
    if (this.isDestroyed) { throw new Error('Cannot delete from destroyed card'); }
    let version = get(this.json, 'data.meta.version');
    if (version == null) {
      await this.load('embedded');
      version = get(this.json, 'data.meta.version');
      if (version == null) {
        throw new Error(`cannot determine version of card '${this.id}'`);
      }
    }

    let internal = priv.get(this);
    let response = await fetch(`${hubURL}/api/cards/${this.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${internal.session.token}`,
        'If-Match': version,
      },
    });
    if (!response.ok) {
      let error = await response.json();
      throw new Error(`Cannot delete card ${response.status}: ${response.statusText}`, error);
    }
    internal.isDestroyed = true;
    cache.isolated.delete(this.id);
    cache.embedded.delete(this.id);
  }

  async _saveCard() {
    if (this.isDestroyed) { throw new Error('Cannot _saveCard from destroyed card'); }
    let internal = priv.get(this);
    let url = this.isNew ? `${hubURL}/api/cards` : `${hubURL}/api/cards/${this.id}`;
    let response = await fetch(url, {
      method: this.isNew ? 'POST' : 'PATCH',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${internal.session.token}`
      },
      body: JSON.stringify(internal.isolatedData)
    });

    let json = await response.json();

    if (!response.ok) {
      throw new Error(`Cannot create card ${response.status}: ${response.statusText}`, json);
    }

    return json;
  }
}

// Our internal state does need to be tracked so that glimmer can rerender
// as it changes, hence this class "bucket-o-state"
class CardInternals {
  @tracked id;
  @tracked isDestroyed;
  @tracked session;
  @tracked isNew;
  @tracked format;
  @tracked isDirty;
  @tracked isLoaded;
  @tracked embeddedData;
  @tracked isolatedData;

  constructor({
    id,
    session,
    isNew,
    format,
    isDirty,
    isLoaded,
    embeddedData,
    isolatedData,
  }) {
    this.id = id;
    this.session = session;
    this.isNew = isNew;
    this.format = format;
    this.isDirty = isDirty;
    this.isLoaded = isLoaded;
    this.embeddedData = embeddedData;
    this.isolatedData = isolatedData;
    this.isDestroyed = false;
  }
}