import Service from '@ember/service';
import { get, set, uniqBy } from 'lodash';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { inject as service } from '@ember/service';

let isolatedCache = new Map();
let embeddedCache = new Map();

export default class DataService extends Service {
  @service cardstackSession;

  async getCard(/*id, format*/) {
    // if the card already exists in the cache, just return cached card
    // return Card instance
  }

  createCard(id) {
    return new Card({ id, format: 'isolated', isNew: true, session: this.cardstackSession });
  }

  async deleteCard(/*id*/) {
    // also make sure to remove cached Card
  }
}

class Card {
  isDirty = false;
  id;
  format;
  embeddedData; // ResourceObject
  isolatedData; // SingleResourceDocument

  constructor({ id, format='embedded', isNew=false, session, embeddedData /* ResourceObject*/ }) {
    // this can be instantiated with an optional embeddedData object, which will be the embedded form of this card
    // that was included as an embedded relationship from another card. This gives us the ability to
    // render embedded cards without having to pay a lookup cost if this card's was included from a
    // 'needed-when-embedded' field of another card.

    this.id = id;
    this.session = session;
    this.isNew = isNew;
    this.format = format;
    this.isLoaded = isolatedCache.has(id) || embeddedCache.has(id);
    this.isDirty = this.isNew || false;
    this.embeddedData = embeddedData || {
      data: { id, type: 'cards' }
    };
    this.isolatedData = {
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
    };
  }

  get json() {
    if (this.format === 'isolated') {
      return JSON.stringify(this.isolatedData, null, 2);
    } else {
      return JSON.stringify(this.embeddedData, null, 2);
    }
  }

  setField(field, value) {
    if (this.format === 'embedded') { throw new Error(`Cannot setField() on card id '${this.id}' because the card is the embedded format. Use reload('isolated') to get the isolated form of the card before setting field values.`)}

    let fieldSchema = (this.isolatedData.included ||[]).find(i => `${i.type}/${i.id}` === `fields/${field}`);
    if (!fieldSchema) { throw new Error(`Cannot setField() on non-existent field 'fields/${field}' for card id '${this.id}'.`); }

    let index = this.isolatedData.included.findIndex(i => `${i.type}/${i.id}` === `${this.id}/${this.id}`);
    let fieldType = get(fieldSchema, 'attributes.field-type');

    // Note that the only kind of relationships that you can fashion are to other cards
    if (fieldType === '@cardstack/core-types::belongs-to') {
      if (value instanceof Card) {
        value = value.id;
      }
      set(this.isolatedData, `included[${index}].relationships.${field}.data`, { type: 'cards', id: value });
    } else if (fieldType === '@cardstack/core-types::has-many') {
      if (!Array.isArray(value)) { throw new Error(`Cannot set cards relationships on card id '${this.id}' from value '${JSON.stringify(value)}'. The value must be an array of card ID's.`); }

      value = [].concat(value.map(i => i instanceof Card ? i.id : i));
      set(this.isolatedData, `included[${index}].relationships.${field}.data`, value.map(id => ({ type: 'cards', id })));
    } else {
      set(this.isolatedData, `included[${index}].attributes.${field}`, value);
    }
    this.included
    this.isDirty = true;
  }

  async getField(/*field*/) {
    // if this.isDirty, should we should throw? as computeds could be impacted by unsaved fields

    // if this.embeddedData or this.isolatedData has the field, then return it.

    // Do note that we need to respect the format of the card when getting a field.
    // getting an isolated-only field when the card is in the embedded format should probably
    // throw an error.

    // if the field value is another Card then instantiate a new Card instance and return that

    // this should only expose card metadata and not internal card fields
  }

  addField(fieldDefinition /*: SingleResourceDocument*/) {
    if (!fieldDefinition.data) { throw new Error(`'addField()' called for card id '${this.id}' is an invalid JSON:API document--missing 'data' property`); }
    if (!fieldDefinition.data.id) { throw new Error(`'addField()' called for card id '${this.id}' is missing 'id' property`); }
    if (!get(fieldDefinition, 'data.attributes.field-type')) { throw new Error(`'addField()' called for card id '${this.id}' is missing a 'field-type' attribute`); }
    // TODO eventually we need to support computed-fields...
    if (fieldDefinition.data.type !== 'fields') { throw new Error(`'addField()' called for card id '${this.id}' does not have a 'type' of 'fields', Rather it is '${fieldDefinition.data.type}/${fieldDefinition.data.id}'.`); }

    let id = fieldDefinition.data.id;
    let type = fieldDefinition.data.type;
    let fields = get(this.isolatedData, 'data.relationships.fields.data');
    if (fields && fields.find(i => `${i.type}/${i.id}` === `${type}/${id}`)) { throw new Error(`'addField() called for card id '${this.id}' to add a new field '${type}/${id}' which already exists for this card.`); }

    if (!fields) {
      fields = [];
      set(this.isolatedData, 'data.relationships.fields.data', fields);
    }
    fields.push({ type, id });

    let included = this.isolatedData.included || [];
    included = included.concat([ fieldDefinition.data ], fieldDefinition.included || []);
    included = uniqBy(included, i => `${i.type}/${i.id}`);
    this.isolatedData.included = included;

    this.isDirty = true;
  }

  removeField(field) {
    if (this.format === 'embedded') { throw new Error(`Cannot removeField() on card id '${this.id}' because the card is the embedded format. Use reload('isolated') to get the isolated form of the card before removing the field.`)}

    let fieldSchema = (this.isolatedData.included ||[]).find(i => `${i.type}/${i.id}` === `fields/${field}`);
    if (!fieldSchema) { throw new Error(`Cannot removeField() on non-existent field 'fields/${field}' for card id '${this.id}'.`); }

    let index = this.isolatedData.included.findIndex(i => `${i.type}/${i.id}` === `${this.id}/${this.id}`);
    let fieldType = get(fieldSchema, 'attributes.field-type');
    let fields = get(this.isolatedData, 'data.relationships.fields.data');

    this.isolatedData.data.relationships.fields.data = fields.filter(i => `${i.type}/${i.id}` !== `fields/${field}`);
    if (fieldType === '@cardstack/core-types::belongs-to' ||
    fieldType === '@cardstack/core-types::has-many') {
      delete this.isolatedData.included[index].relationships[field];
    } else {
      delete this.isolatedData.included[index].attributes[field];
    }
    this.isolatedData.included = (this.isolatedData.included ||{}).filter(i => `${i.type}/${i.id}` !== `fields/${field}`);
  }

  moveField(/*field, position*/) {
  }

  allFields() {
    // this returns all the Card's metadata fields in the correct order and the field types so we know how to render them. Perhaps, we just return
    // the JSON:API ResourceObjects for each field to make it simple for now?

    // We also need to think about how to invoke with for an embedded card. it would be nice to not have to make an extra
    // trip over the wire for each embedded card in order to render it--which I think means that the embedded form of a card
    // needs to have enough schema information about it's fields to be able to communicate to the client how to render the field.
  }

  async save() {
    if (!this.isDirty) { return this; }

    isolatedCache.set(this.id, this._saveCard());
    this.isolatedData = await isolatedCache.get(this.id);

    this.isNew = false;
    this.isDirty = false;
    this.isLoaded = true;

    return this;
  }

  async _saveCard() {
    let response = await fetch(`${hubURL}/api/cards`, {
      method: this.isNew ? 'POST' : 'PATCH',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.session.token}`
      },
      body: JSON.stringify(this.isolatedData)
    });

    let json = await response.json();

    if (!response.ok) {
      // TODO make sure this errors looks the way you want it too...
      throw new Error(`Cannot create card ${response.status}: ${response.statusText}`, json);
    }

    return json;
  }

  async load(format='isolated') {
    // get the lastest version of the card from the hub, and update the data service cache. load the requested card format

    // this is analogous to the card polling that we've done in other projects like cardfolio and tally
    // in the case where there is an indexer that is feeding the card new field data

    //TODO test this
    if (format !== 'embedded' || format !== 'isolated') { throw new Error(`unknown format specified in 'load()' for card '${this.id}': '${format}'`); }

    this.format = format;
    // TODO issue fetch to get card...
  }
}