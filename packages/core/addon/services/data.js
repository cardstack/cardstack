import Service from '@ember/service';
import { get, set, uniqBy, merge, cloneDeep, unionBy, difference, partition, startCase } from 'lodash';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { isEmpty } from '@ember/utils';

const cardIdDelim = '::';
const baseCard = 'local-hub::@cardstack/base-card'; // eventually base-cards will not come from local-hub, but rather an official cardstack catalog repository

let fieldNonce = 0;
let priv = new WeakMap();
let store = {
  isolated: new Map(),
  embedded: new Map(),
};

export default class DataService extends Service {
  @service cardstackSession;
  @service cardLocalStorage;

  static FIELD_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

  async getCard(id, format) {
    if (!['isolated', 'embedded'].includes(format)) {
      throw new Error(`unknown format specified when getting card '${id}': '${format}'`);
    }

    if (store[format].has(id)) {
      return new Card({
        id,
        loadedFormat: format,
        session: this.cardstackSession,
        data: await store[format].get(id),
      });
    } else {
      let card = new Card({
        id,
        loadedFormat: format,
        session: this.cardstackSession,
      });
      return await card.load(format);
    }
  }

  createCard(id, adoptedFrom) {
    // remove the next line once we have progressive data handling
    this.cardLocalStorage.addRecentCardId(id);
    return new Card({
      id,
      adoptedFrom,
      isNew: true,
      loadedFormat: 'isolated',
      session: this.cardstackSession,
    });
  }

  async allCardsInStore() {
    let isolatedCards = await Promise.all(
      [...store.isolated.keys()].map(
        async id =>
          new Card({
            id,
            loadedFormat: 'isolated',
            session: this.cardstackSession,
            data: await store.isolated.get(id),
          })
      )
    );
    let embeddedCards = await Promise.all(
      difference([...store.embedded.keys()], [...store.isolated.keys()]).map(
        async id =>
          new Card({
            id,
            loadedFormat: 'embedded',
            session: this.cardstackSession,
            data: await store.embedded.get(id),
          })
      )
    );

    return isolatedCards.concat(embeddedCards);
  }

  // used for tests
  _clearCache() {
    store.isolated = new Map();
    store.embedded = new Map();
  }
}

class Card {
  constructor({ id, adoptedFrom, loadedFormat = 'embedded', isNew = false, session, data }) {
    if (id.split(cardIdDelim).length !== 2) {
      throw new Error(
        `The card ID '${id}' format is incorrect. The card ID must be formatted as 'repository::card-name'`
      );
    }
    if (adoptedFrom && adoptedFrom.isNew) {
      throw new Error(
        `Cannot create card '${id}', the card you are trying to adopt '${adoptedFrom.id}' has not been saved yet. Please save the card '${adoptedFrom.id}' first.`
      );
    }

    // this keeps our internal state private
    let adoptedFromId = get(data, 'data.relationships.adopted-from.data.id');
    if (adoptedFrom) {
      adoptedFromId = adoptedFrom.id;
    }

    priv.set(
      this,
      new CardInternals({
        id,
        isDestroyed: false,
        adoptedFrom,
        session,
        isNew,
        loadedFormat,
        isDirty: isNew || false,
        isolatedCss: data ? get(data, 'data.attributes.isolated-css') : null,
        embeddedCss: data ? get(data, 'data.attributes.embedded-css') : null,
        serverEmbeddedData: (loadedFormat === 'embedded' ? data : null) || {
          data: { id, type: 'cards' },
        },
        serverIsolatedData: (loadedFormat === 'isolated' ? data : null) || {
          data: {
            id,
            type: 'cards',
            relationships: {
              fields: {
                data: [],
              },
              'adopted-from': {
                data: { type: 'cards', id: adoptedFromId },
              },
              model: {
                data: { type: id, id },
              },
            },
          },
          included: [{ id, type: id }],
        },
      })
    );

    reifyCard(this);

    // handle the scenario where a new card is being created. In this case if you want your
    // new card to adopted from a specific card, the card you want to adopt from must be fully loaded
    // so we know what all fields will be inherited from the adopted card.
    if (adoptedFrom) {
      let internal = priv.get(this);
      internal.isolatedCss = adoptedFrom.isolatedCss;
      internal.embeddedCss = adoptedFrom.embeddedCss;

      constructAdoptedFields(this, adoptedFrom);
    }
  }

  toString() {
    return this.id;
  }

  get id() {
    return priv.get(this).id;
  }

  get repository() {
    return this.id.split(cardIdDelim)[0];
  }

  get name() {
    return this.id.split(cardIdDelim)[1];
  }

  get loadedFormat() {
    return priv.get(this).loadedFormat;
  }

  get isNew() {
    return priv.get(this).isNew;
  }

  get isDirty() {
    return priv.get(this).isDirty;
  }

  get isDestroyed() {
    return priv.get(this).isDestroyed;
  }

  get fields() {
    return priv.get(this).fields;
  }

  get adoptedFromId() {
    let internal = priv.get(this);

    if (internal.id === baseCard) {
      return null;
    }

    let adoptedFromId;
    if ((adoptedFromId = get(internal, 'adoptedFrom.id'))) {
      return adoptedFromId;
    }

    let cardJson =
      this.loadedFormat === 'isolated' ? get(internal, 'serverIsolatedData') : get(internal, 'serverEmbeddedData');
    return get(cardJson, `data.relationships.adopted-from.data.id`) || baseCard;
  }

  get adoptedFromName() {
    if (!this.adoptedFromId) {
      return null;
    }
    return this.adoptedFromId.split(cardIdDelim)[1];
  }

  get adoptedFrom() {
    if (this.loadedFormat === 'embedded') {
      throw new Error(
        `The card '${this.id}' must be loaded in the isolated format first before you can get the adoptedFrom. Invoke card.load() first, before getting adoptedFrom`
      );
    }
    return priv.get(this).adoptedFrom;
  }

  get isolatedFields() {
    if (this.loadedFormat === 'embedded') {
      throw new Error(
        `Cannot get isolatedFields for card '${this.id}' because card has not loaded isolated format. Invoke card.load() first, before getting isolatedFields`
      );
    }
    return this.fields;
  }

  get embeddedFields() {
    return this.fields.filter(i => i.neededWhenEmbedded);
  }

  get isolatedCss() {
    return priv.get(this).isolatedCss;
  }

  get embeddedCss() {
    return priv.get(this).embeddedCss;
  }

  // This returns the most deeply loaded version of the card you have, so isolated if loaded, embedded if not
  get json() {
    return getCardDocument(this);
  }

  setAdoptedFrom(card) {
    if (!card) {
      throw new Error('Cannot setAdoptedFrom, no card was specified to adopt from');
    }
    if (this.isDestroyed) {
      throw new Error('Cannot setAdoptedFrom from destroyed card');
    }
    if (card.isDestroyed) {
      throw new Error(`Cannot setAdoptedFrom, the specifed card to adopt '${card.id}' has been destroyed`);
    }
    if (card.loadedFormat !== 'isolated') {
      throw new Error(
        `Cannot setAdoptedFrom to use the provided card '${card.id}' because it is not fully loaded. Call card.load() on the card you wish to adopt from first.`
      );
    }
    if (this.loadedFormat !== 'isolated') {
      throw new Error(
        `Cannot setAdoptedFrom on the card '${this.id}' because it is not fully loaded. Call card.load() on your card before calling setAdoptedFrom().`
      );
    }
    if (card.isNew) {
      throw new Error(
        `Cannot setAdoptedFrom, the card you are trying to adopt '${card.id}' has not been saved yet. Please save the card '${card.id}' first.`
      );
    }

    if (this.adoptedFrom && this.adoptedFrom.id === card.id) {
      return this;
    } // you are already adopting this card, do nothing

    let ownFields = this.fields.filter(i => !i.isAdopted);
    let conflictingFields = ownFields.filter(i => card.fields.find(j => j.name === i.name));
    if (conflictingFields.length) {
      throw new Error(
        `Cannot setAdoptedFrom to use the provided card '${card.id}' because the field(s) ${conflictingFields
          .map(i => "'" + i.name + "'")
          .join(', ')} conflict with the specified card to adopt from.`
      );
    }

    let internal = priv.get(this);
    let oldAdoptedFrom = this.adoptedFrom;
    if (oldAdoptedFrom) {
      internal.serverIsolatedData.included = (internal.serverIsolatedData.included || []).filter(
        i => `${i.type}/${i.id}` !== `cards/${oldAdoptedFrom.id}`
      );
    }

    // remove adopted fields (and their included data) that do not have the same source as the fields set in card
    let namespacedAdoptedFields = card.fields.map(i => `${i.source}::${i.name}`);
    let fieldToRemove = this.fields.filter(
      i => i.isAdopted && !namespacedAdoptedFields.includes(`${i.source}::${i.name}`)
    );
    for (let field of fieldToRemove) {
      internal.fields = internal.fields.filter(i => i.name !== field.name);
      if (field.value && field.type === '@cardstack/core-types::belongs-to' && field.value.id) {
        internal.serverIsolatedData.included = (internal.serverIsolatedData.included || []).filter(
          i => `${i.type}/${i.id}` !== `cards/${field.value.id}`
        );
      } else if (
        field.value &&
        field.type === '@cardstack/core-types::has-many' &&
        Array.isArray(field.value) &&
        field.value.every(i => get(i, 'constructor.name') === 'Card')
      ) {
        let removedIncludeds = field.value.map(i => `cards/${i.id}`);
        internal.serverIsolatedData.included = (internal.serverIsolatedData.included || []).filter(
          i => !removedIncludeds.includes(`${i.type}/${i.id}`)
        );
      }

      let fieldInternals = priv.get(field);
      fieldInternals.isDestroyed = true;
    }

    constructAdoptedFields(this, card);

    // if you change the adopted parent, you need to accept the adopted parent's css
    // even if you have customized it already from the previous parent, as changing the adoptedFrom means
    // that the template will likely be different and the CSS you were using is likely
    // incorrect because of the changed template.
    internal.isolatedCss = card.isolatedCss;
    internal.embeddedCss = card.embeddedCss;

    // eslint-disable-next-line no-self-assign
    internal.fields = internal.fields; // oh glimmer, you so silly...
    internal.isDirty = true;

    return this;
  }

  getField(fieldName) {
    if (this.isDestroyed) {
      throw new Error('Cannot call getField from destroyed card');
    }
    let internal = priv.get(this);
    return (internal.fields || []).find(i => i.name === fieldName);
  }

  getFieldByNonce(fieldNonce) {
    if (this.isDestroyed) {
      throw new Error('Cannot call getFieldByNonce from destroyed card');
    }
    let internal = priv.get(this);
    return (internal.fields || []).find(i => i.nonce === fieldNonce);
  }

  addField({ name, label, type, instructions, neededWhenEmbedded = false, value, position }) {
    if (this.isDestroyed) {
      throw new Error('Cannot addField from destroyed card');
    }
    if (this.loadedFormat === 'embedded') {
      throw new Error(
        `Cannot addField() on card id '${this.id}' because the card is in the embedded format. Use card.load() to get the isolated form of the card before adding fields.`
      );
    }
    if (!name) {
      throw new Error(`'addField()' called for card id '${this.id}' is missing 'name'`);
    }
    if (!type) {
      throw new Error(`'addField()' called for card id '${this.id}' is missing 'type'`);
    }
    if (this.fields.find(i => i.name === name)) {
      throw new Error(
        `'addField() called for card id '${this.id}' to add a new field 'fields/${name}' which already exists for this card.`
      );
    }

    label = label || name;
    let field = new Field({
      card: this,
      name,
      label,
      type,
      neededWhenEmbedded,
      instructions,
      value,
      source: this.id,
    });
    let internal = priv.get(this);
    internal.fields.push(field);
    if (position != null) {
      this.moveField(field, position);
    }
    // eslint-disable-next-line no-self-assign
    internal.fields = internal.fields; // oh glimmer, you so silly...
    internal.isDirty = true;
    return field;
  }

  moveField(field, position) {
    if (this.isDestroyed) {
      throw new Error('Cannot moveField from destroyed card');
    }
    if (this.loadedFormat === 'embedded') {
      throw new Error(
        `Cannot moveField() on card id '${this.id}' because the card is in the embedded format. Use card.load() to get the isolated form of the card before moving the field.`
      );
    }
    if (!(field instanceof Field)) {
      throw new Error(`Cannot moveField(), the field specified is not an instance of the Field class`);
    }
    if (position > this.fields.length - 1) {
      throw new Error(
        `Cannot movefield(). The specified position '${position}' is beyond the bounds of the field positions for this card '${this.id}'.`
      );
    }

    let currentIndex = this.fields.findIndex(i => i === field);
    if (currentIndex === position) {
      return field;
    } // the position is not actually changing

    if (currentIndex === -1) {
      throw new Error(`Cannot moveField(). The field specified is not a field of the card '${this.id}'`);
    }

    let internal = priv.get(this);
    internal.fields.splice(position, 0, internal.fields.splice(currentIndex, 1)[0]);
    // eslint-disable-next-line no-self-assign
    internal.fields = internal.fields; // oh glimmer, you so silly...
    internal.isDirty = true;

    return field;
  }

  setIsolatedCss(css) {
    return setCss(this, 'isolated', css);
  }

  setEmbeddedCss(css) {
    return setCss(this, 'embedded', css);
  }

  async save() {
    if (this.isDestroyed) {
      throw new Error('Cannot save from destroyed card');
    }
    if (!this.isDirty) {
      return this;
    }

    // if the card is embedded, let's load the isolated card data and merge the updated card with the isolated data
    // we don't want to indavertantly clear fields of the card just because the embedded format does not
    // use a field. The use case for this is the ability of a user to edit owned relationships that are cards
    let internal = priv.get(this);
    if (this.loadedFormat === 'embedded') {
      let updatedFields = this.fields;
      await this.load('isolated');
      internal.fields = unionBy(updatedFields, internal.fields, i => i.name);
    }

    store.isolated.set(this.id, save(internal.session, this.json, this.isNew));
    internal.serverIsolatedData = await store.isolated.get(this.id);
    if (!this.isNew) {
      await invalidate(this.id);
    }
    for (let card of (internal.serverIsolatedData.included || []).filter(i => i.type === 'cards')) {
      store.embedded.set(card.id, new Promise(res => res({ data: card })));
    }

    internal.isNew = false;
    internal.isDirty = false;

    reifyCard(this);

    return this;
  }

  async load(format = 'isolated') {
    if (this.isDestroyed) {
      throw new Error('Cannot load from destroyed card');
    }
    if (!['isolated', 'embedded'].includes(format)) {
      throw new Error(`unknown format specified in 'load()' for card '${this.id}': '${format}'`);
    }

    // It's really kind of odd to explicitly load the embedded format for a Card, as the embedded format should have been loaded
    // via another card's relationships to this card. I wonder if we should just only ever load the isolated format in this method...
    if (format === 'embedded' && this.loadedFormat === 'isolated') {
      return this;
    } // the embedded format has already been loaded

    let internal = priv.get(this);
    internal.loadedFormat = format;
    store[format].set(this.id, load(internal.session, this.id, format));
    if (format === 'isolated') {
      internal.serverIsolatedData = await store[format].get(this.id);
      await invalidate(this.id, get(internal.serverIsolatedData, 'data.meta.version'));
      for (let card of (internal.serverIsolatedData.included || []).filter(i => i.type === 'cards')) {
        await invalidate(card.id, get(card, 'meta.version'));
        store.embedded.set(card.id, new Promise(res => res({ data: card })));
      }
    } else {
      internal.serverEmbeddedData = await store[format].get(this.id);
      await invalidate(this.id, get(internal.serverEmbeddedData, 'data.meta.version'));
      for (let card of (internal.serverEmbeddedData.included || []).filter(i => i.type === 'cards')) {
        await invalidate(card.id, get(card, 'meta.version'));
        store.embedded.set(card.id, new Promise(res => res({ data: card })));
      }
    }

    reifyCard(this);
    internal.isLoaded = true;

    return this;
  }

  async delete() {
    if (this.isDestroyed) {
      throw new Error('Cannot delete from destroyed card');
    }
    let version = get(this.json, 'data.meta.version');
    if (version == null) {
      await this.load('embedded');
      version = get(this.json, 'data.meta.version');
      if (version == null) {
        throw new Error(`cannot determine version of card '${this.id}'`);
      }
    }

    let internal = priv.get(this);
    let response = await fetch(`${hubURL}/api/cards/${encodeURIComponent(this.id)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${internal.session.token}`,
        'If-Match': version,
      },
    });
    if (!response.ok) {
      let error = await response.json();
      throw new Error(`Cannot delete card ${response.status}: ${response.statusText}`, error);
    }
    for (let field of this.fields) {
      priv.get(field).isDestroyed = true;
    }
    await invalidate(this.id);
    internal.isDestroyed = true;
    store.isolated.delete(this.id);
    store.embedded.delete(this.id);
  }
}

// Note this Field class is only used to represent metadata fields.
// Internal card fields (fields not exposed as metadata) are intentionally
// not exposed by this API--maybe we decide to change that in the future...
class Field {
  constructor({ card, name, type, label, instructions, source, neededWhenEmbedded, isAdopted, value }) {
    // this keeps our internal state private
    priv.set(
      this,
      new FieldInternals({
        card,
        name,
        type,
        label,
        source,
        instructions,
        neededWhenEmbedded,
        isAdopted,
        value,
      })
    );
  }

  toString() {
    let internal = priv.get(this); // using field internals so we can call toString even after Field is destroyed
    return `<field ${internal.name} (of ${internal.card})>`;
  }

  get fieldNameRegex() {
    return DataService.FIELD_NAME_REGEX;
  }

  get nonce() {
    return priv.get(this).nonce;
  }

  get card() {
    return priv.get(this).card;
  }

  get source() {
    return priv.get(this).source;
  }

  get name() {
    return priv.get(this).name;
  }

  get label() {
    return priv.get(this).label;
  }

  get instructions() {
    return priv.get(this).instructions;
  }

  get type() {
    return priv.get(this).type;
  }

  get position() {
    return this.card.fields.findIndex(i => i.name === this.name);
  }

  get neededWhenEmbedded() {
    return priv.get(this).neededWhenEmbedded;
  }

  get value() {
    return priv.get(this).value;
  }

  get isDestroyed() {
    return priv.get(this).isDestroyed;
  }

  get isAdopted() {
    return priv.get(this).isAdopted;
  }

  get json() {
    let { name: id, type, neededWhenEmbedded, serverData, label = null, instructions = null } = priv.get(this);
    // We're returning a JSON:API document here (as opposed to a resource) since eventually
    // a field may encapsulate constraints as included resources within its document
    return {
      data: merge(cloneDeep(serverData) || {}, {
        id,
        type: 'fields',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': neededWhenEmbedded,
          'field-type': type,
          caption: label,
          instructions: instructions,
        },
      }),
    };
  }

  setName(name) {
    if (this.isDestroyed) {
      throw new Error('Cannot setName from destroyed field');
    }
    if (this.isAdopted) {
      throw new Error(
        `Cannot setName() on card id '${this.card.id}', field: '${this.name}' because this field is an adopted field and adopted fields cannot have their name changed.`
      );
    }
    if (!DataService.FIELD_NAME_REGEX.test(name)) {
      throw new Error('Field name must only contain letters, numbers, dashes and underscores');
    }

    let internal = priv.get(this);
    let internalCard = priv.get(this.card);
    let oldName = internal.name;
    if (name === oldName) {
      return this;
    } // nothing is changing, so do nothing
    if (this.card.getField(name)) {
      throw new Error(
        `Cannot change the field name from '${this.name}' to '${name}'. A field with the name '${name}' already exists in this card '${this.card.id}'.`
      );
    }

    internal.name = name;
    internalCard.serverIsolatedData.included = (internalCard.serverIsolatedData.included || []).filter(
      i => `${i.type}/${i.id}` !== `fields/${oldName}`
    );

    // eslint-disable-next-line no-self-assign
    internalCard.fields = internalCard.fields; // oh glimmer, you so silly...
    internalCard.isDirty = true;

    this.setLabel(startCase(name));

    return this;
  }

  setLabel(label) {
    if (this.isDestroyed) {
      throw new Error('Cannot setLabel from destroyed field');
    }
    if (this.isAdopted) {
      throw new Error(
        `Cannot setLabel() on card id '${this.card.id}', field: '${this.name}' because this field is an adopted field and adopted fields cannot have their label changed.`
      );
    }

    let internal = priv.get(this);
    let internalCard = priv.get(this.card);

    if (isEmpty(label)) {
      label = internal.name;
    }

    internal.label = label;

    // eslint-disable-next-line no-self-assign
    internalCard.fields = internalCard.fields; // oh glimmer, you so silly...
    internalCard.isDirty = true;

    return this;
  }

  setInstructions(label) {
    if (this.isDestroyed) {
      throw new Error('Cannot setInstructions from destroyed field');
    }
    if (this.isAdopted) {
      throw new Error(
        `Cannot setInstructions() on card id '${this.card.id}', field: '${this.name}' because this field is an adopted field and adopted fields cannot have their instructions changed.`
      );
    }

    let internal = priv.get(this);
    let internalCard = priv.get(this.card);

    internal.instructions = label;

    // eslint-disable-next-line no-self-assign
    internalCard.fields = internalCard.fields; // oh glimmer, you so silly...
    internalCard.isDirty = true;

    return this;
  }

  setValue(value) {
    if (this.isDestroyed) {
      throw new Error('Cannot setValue from destroyed field');
    }

    let internal = priv.get(this);
    let internalCard = priv.get(this.card);

    // Note that the only kind of relationships that you can fashion are to other cards
    if (this.type === '@cardstack/core-types::belongs-to') {
      if (!(value instanceof Card)) {
        value = new Card({ id: value, session: internalCard.session });
      }
      internal.value = value;
    } else if (this.type === '@cardstack/core-types::has-many') {
      if (!Array.isArray(value)) {
        throw new Error(
          `Cannot set cards relationships on card id '${this.card.id}', field '${
            this.name
          }' from value '${JSON.stringify(value)}'. The value must be an array of Cards.`
        );
      }

      value = [].concat(
        value.map(i => (!(i instanceof Card) ? new Card({ id: i, session: internalCard.session }) : i))
      );
      internal.value = value;
    } else {
      internal.value = value;
    }
    internalCard.isDirty = true;
    // eslint-disable-next-line no-self-assign
    internalCard.fields = internalCard.fields; // oh glimmer, you so silly...

    return this;
  }

  remove() {
    if (this.isDestroyed) {
      throw new Error('Cannot removeField from destroyed field');
    }
    if (this.card.loadedFormat === 'embedded') {
      throw new Error(
        `Cannot removeField() on card id '${this.card.id}', field '${this.name}' because the card is in the embedded format. Use card.load('isolated') to get the isolated form of the card before removing the field.`
      );
    }
    if (this.isAdopted) {
      throw new Error(
        `Cannot removeField() on card id '${this.card.id}', field: '${this.name}' because this field is an adopted field and adopted fields cannot be removed.`
      );
    }

    let internal = priv.get(this);
    let internalCard = priv.get(this.card);

    internalCard.fields = internalCard.fields.filter(i => i.name !== this.name);
    internalCard.serverIsolatedData.included = (internalCard.serverIsolatedData.included || []).filter(
      i => `${i.type}/${i.id}` !== `fields/${this.name}`
    );
    // eslint-disable-next-line no-self-assign
    internal.serverIsolatedData = internal.serverIsolatedData; // oh glimmer, you so silly...
    internalCard.isDirty = true;
    internal.isDestroyed = true;
  }

  setNeededWhenEmbedded(neededWhenEmbedded) {
    if (this.isDestroyed) {
      throw new Error('Cannot setNeededWhenEmbedded() from destroyed field');
    }
    if (this.card.loadedFormat === 'embedded') {
      throw new Error(
        `Cannot setNeededWhenEmbedded() on card id '${this.card.id}', field '${this.name}' because the card is in the embedded format. Use card.load('isolated') to get the isolated form of the card.`
      );
    }
    if (this.isAdopted) {
      throw new Error(
        `Cannot setNeededWhenEmbedded() on card id '${this.card.id}', field: '${this.name}' because this field is an adopted field and adopted fields cannot have their neededWhenEmbedded value changed.`
      );
    }

    let internal = priv.get(this);
    if (internal.neededWhenEmbedded === neededWhenEmbedded) {
      return this;
    }

    let internalCard = priv.get(this.card);
    internal.neededWhenEmbedded = neededWhenEmbedded;
    internalCard.isDirty = true;

    // eslint-disable-next-line no-self-assign
    internalCard.fields = internalCard.fields; // oh glimmer, you so silly...

    return this;
  }
}

// Our internal state does need to be tracked so that glimmer can rerender
// as it changes, hence this class "bucket-o-state"
class CardInternals {
  @tracked id;
  @tracked isDestroyed;
  @tracked session;
  @tracked isNew;
  @tracked loadedFormat;
  @tracked isDirty;
  @tracked isLoaded;
  @tracked isolatedCss;
  @tracked embeddedCss;
  @tracked serverEmbeddedData;
  @tracked serverIsolatedData;
  @tracked fields;
  @tracked adoptedFrom;

  constructor({
    id,
    session,
    isNew,
    loadedFormat,
    isDirty,
    isLoaded,
    fields = [],
    isolatedCss,
    embeddedCss,
    serverEmbeddedData,
    serverIsolatedData,
    adoptedFrom,
  }) {
    this.id = id;
    this.session = session;
    this.isNew = isNew;
    this.loadedFormat = loadedFormat;
    this.isDirty = isDirty;
    this.isLoaded = isLoaded;
    this.isolatedCss = isolatedCss;
    this.embeddedCss = embeddedCss;
    this.serverEmbeddedData = serverEmbeddedData;
    this.serverIsolatedData = serverIsolatedData;
    this.isDestroyed = false;
    this.fields = fields;
    this.adoptedFrom = adoptedFrom;
  }
}

class FieldInternals {
  @tracked nonce;
  @tracked card;
  @tracked name;
  @tracked label;
  @tracked instructions;
  @tracked type;
  @tracked neededWhenEmbedded;
  @tracked isAdopted;
  @tracked value;
  @tracked source;
  @tracked serverData;
  @tracked isDestroyed;
  // TODO add contraints and "related cards" capabilities

  constructor({ card, name, label, instructions, type, neededWhenEmbedded, isAdopted, value, source, serverData }) {
    this.card = card;
    this.name = name;
    this.label = label;
    this.instructions = instructions;
    this.type = type;
    this.neededWhenEmbedded = Boolean(neededWhenEmbedded);
    this.isAdopted = Boolean(isAdopted);
    this.value = value;
    this.source = source;
    this.serverData = serverData;
    this.isDestroyed = false;
    this.nonce = fieldNonce++;
  }
}

function setCss(card, format, css) {
  if (card.isDestroyed) {
    throw new Error('Cannot set css from destroyed card');
  }
  if (card.loadedFormat === 'embedded') {
    throw new Error(
      `Cannot set css on card id '${card.id}' because the card is not fully loaded. Call card.load() first before setting css.`
    );
  }

  let internal = priv.get(card);
  internal[`${format}Css`] = css;
  internal.isDirty = true;

  return card;
}

function cloneField(field, cardForField) {
  let currentField = cardForField.getField(field.name);
  if (currentField && currentField.source === field.source) {
    // we're already adopting this, do nothing
    return;
  }

  let internal = priv.get(cardForField);
  let { name, type, label, neededWhenEmbedded, source, instructions } = field;
  let clonedField = new Field({
    card: cardForField,
    name,
    type,
    label,
    source,
    instructions,
    isAdopted: true,
    neededWhenEmbedded,
  });
  internal.fields.push(clonedField);

  // eslint-disable-next-line no-self-assign
  internal.fields = internal.fields; // oh glimmer, you so silly...
  internal.isDirty = true;
}

function getCardDocument(card) {
  let format = card.loadedFormat;
  let internal = priv.get(card);
  let document = cloneDeep(format === 'isolated' ? internal.serverIsolatedData : internal.serverEmbeddedData);

  let modelAttributes = {};
  let modelRelationships = {};

  // TODO this is going to strip out internal fields from the card. update this so that
  // we are respectful of the internal fields (which should exist in the internal.serverIsolatedData)
  for (let field of card.fields) {
    if (field.value === undefined) {
      continue;
    }
    if (['@cardstack/core-types::belongs-to', '@cardstack/core-types::has-many'].includes(field.type)) {
      modelRelationships[field.name] = {
        data: field.type.includes('has-many')
          ? (field.value || []).map(i => ({ type: 'cards', id: i.id }))
          : field.value
          ? { type: 'cards', id: field.value.id }
          : null,
      };
    } else {
      modelAttributes[field.name] = field.value;
    }
  }

  // TODO make sure that we filter out internal fields from field-order
  set(
    document,
    `data.attributes.field-order`,
    card.fields.map(i => i.name)
  );
  set(
    document,
    `data.relationships.fields.data`,
    card.fields.filter(i => !i.isAdopted).map(i => ({ type: 'fields', id: i.name }))
  );
  set(document, `data.attributes.isolated-css`, card.isolatedCss || null);
  set(document, `data.attributes.embedded-css`, card.embeddedCss || null);

  if (format === 'isolated') {
    let modelIndex = document.included.findIndex(i => `${i.type}/${i.id}` === `${card.id}/${card.id}`);
    if (Object.keys(modelAttributes).length) {
      set(document, `included[${modelIndex}].attributes`, modelAttributes);
    }
    if (Object.keys(modelRelationships).length) {
      set(document, `included[${modelIndex}].relationships`, modelRelationships);
    }

    let fieldLookup = {};
    for (let field of card.fields) {
      if (field.isAdopted) {
        continue;
      }
      fieldLookup[`fields/${field.name}`] = field;
    }
    // updates existing field schema
    document.included = document.included.map(i =>
      Object.keys(fieldLookup).includes(`${i.type}/${i.id}`)
        ? merge({}, i, fieldLookup[`${i.type}/${i.id}`].json.data)
        : i
    );
    // adds new field schema
    document.included = uniqBy(
      document.included.concat(card.fields.filter(i => !i.isAdopted).map(i => i.json.data)),
      i => `${i.type}/${i.id}`
    );
  }

  let adoptedFromId = get(internal, 'serverIsolatedData.data.relationships.adopted-from.data.id') || baseCard;
  set(document, `data.relationships.adopted-from.data`, { type: 'cards', id: adoptedFromId });

  return document;
}

function getCardMetadata(card, type, fieldName) {
  let { session } = priv.get(card);
  if (type === '@cardstack/core-types::has-many') {
    let refs = get(card.json, `data.relationships.${fieldName}.data`) || [];
    return refs.map(({ id }) => {
      let embeddedCard = (card.json.included || []).find(i => `${i.type}/${i.id}` === `cards/${id}`);
      return new Card({
        id,
        session: session,
        data: embeddedCard ? { data: embeddedCard } : null,
      });
    });
  } else if (type === '@cardstack/core-types::belongs-to') {
    let { id } = get(card.json, `data.relationships.${fieldName}.data`) || {};
    let embeddedCard = (card.json.included || []).find(i => `${i.type}/${i.id}` === `cards/${id}`);
    return id
      ? new Card({
          id,
          session: session,
          data: embeddedCard ? { data: embeddedCard } : null,
        })
      : undefined;
  } else {
    return get(card.json, `data.attributes.${fieldName}`);
  }
}

function constructAdoptedFields(child, parent) {
  if (parent.loadedFormat !== 'isolated') {
    throw new Error(
      `The card you wish to adopt '${parent.id}' must be loaded in the 'isolated' format first before you can create a card that adopts from it.`
    );
  }
  if (child.loadedFormat !== 'isolated') {
    throw new Error(
      `The card whose adoption you are setting '${child.id}' must be loaded in the 'isolated' format first before you can set it's adopted-from card.`
    );
  }

  let internal = priv.get(child);
  internal.adoptedFrom = parent;
  set(internal.serverIsolatedData, 'data.relationships.adopted-from.data', { type: 'cards', id: parent.id });
  for (let field of parent.fields) {
    cloneField(field, child);
  }
}

function reifyCard(card) {
  let unorderedFields = {};
  let internal = priv.get(card);
  let cardJson =
    card.loadedFormat === 'isolated' ? get(internal, 'serverIsolatedData') : get(internal, 'serverEmbeddedData');
  if (!cardJson) {
    throw new Error(`Card document from server for '${card.id}' does not exist`);
  }

  internal.isolatedCss = get(cardJson, 'data.attributes.isolated-css') || null;
  internal.embeddedCss = get(cardJson, 'data.attributes.embedded-css') || null;

  let fieldSummary = get(cardJson, 'data.attributes.metadata-summary') || {};
  let [adoptedFieldNames, nonAdoptedFieldNames] = partition(Object.keys(fieldSummary), i => fieldSummary[i].isAdopted);
  let orderedFieldNames = adoptedFieldNames.concat(nonAdoptedFieldNames);
  for (let name of orderedFieldNames) {
    let { type, label, source, isAdopted, instructions, neededWhenEmbedded } = fieldSummary[name];
    let value = getCardMetadata(card, type, name);

    unorderedFields[name] = new Field({
      card,
      name,
      label,
      type,
      instructions,
      neededWhenEmbedded,
      source,
      isAdopted,
      value,
    });
  }
  let fieldOrder = get(cardJson, 'data.attributes.field-order') || [];
  internal.fields = fieldOrder.map(i => unorderedFields[i]);

  if (card.id !== baseCard && card.loadedFormat === 'isolated') {
    let id = get(cardJson, `data.relationships.adopted-from.data.id`) || baseCard;
    if (!card.adoptedFrom || card.adoptedFrom.id !== id) {
      let data = (cardJson.included || []).find(i => `${i.type}/${i.id}` === `cards/${id}`);
      let adoptedFrom = new Card({
        id,
        data: { data },
        session: card.session,
      });
      internal.adoptedFrom = adoptedFrom;
    }
  }
}

async function invalidate(cardId, latestVersion) {
  if (cardId === baseCard) {
    return;
  } // don't invalidate the base card--it never changes, and everything descends from it

  for (let format of ['isolated', 'embedded']) {
    for (let [id, entry] of store[format].entries()) {
      let card = await entry;

      for (let adoptedCardId of get(card, 'data.attributes.adoption-chain') || []) {
        if (adoptedCardId === cardId) {
          store[format].delete(id);
          break;
        }
      }
      for (let relationship of Object.keys(get(card, 'data.relationships') || {})) {
        let linkage = get(card, `data.relationships.${relationship}.data`);
        if (!linkage) {
          continue;
        }
        if (
          latestVersion == null &&
          Array.isArray(linkage) &&
          linkage.map(i => `${i.type}/${i.id}`).includes(`cards/${cardId}`)
        ) {
          store[format].delete(id);
          break;
        } else if (latestVersion == null && `${linkage.type}/${linkage.id}` === `cards/${cardId}`) {
          store[format].delete(id);
          break;
        }
      }
      if (Array.isArray(card.included) && store[format].has(id)) {
        if (latestVersion == null && card.included.map(i => `${i.type}/${i.id}`).includes(`cards/${cardId}`)) {
          store[format].delete(id);
        } else if (
          latestVersion != null &&
          card.included
            .filter(i => `${i.type}/${i.id}` === `cards/${cardId}`)
            .some(i => get(i, 'meta.version') !== latestVersion)
        ) {
          store[format].delete(id);
        }
      }
    }
  }
}

async function save(session, cardDocument, isNew) {
  let id = cardDocument.data.id;
  let url = isNew ? `${hubURL}/api/cards` : `${hubURL}/api/cards/${encodeURIComponent(id)}`;
  let response = await fetch(url, {
    method: isNew ? 'POST' : 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(cardDocument),
  });

  let json = await response.json();

  if (!response.ok) {
    throw new Error(`Cannot save card ${response.status}: ${response.statusText}`, json);
  }

  return json;
}

async function load(session, id, format) {
  let response = await fetch(`${hubURL}/api/cards/${encodeURIComponent(id)}?format=${format}`, {
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${session.token}`,
    },
  });

  let json = await response.json();
  if (!response.ok) {
    throw new Error(`Cannot load card ${response.status}: ${response.statusText}`, json);
  }
  return json;
}
