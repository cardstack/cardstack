/*
  <@producer.firstName />
  <SmallPersonVariant @producer={{@producer}} />


  {{! small-person-variant.hbs }}

  {{type @model "person"}}
  {{type this.whatever "date"}}

  <@producer.firstName />

*/

// The serialized format of a card, including its entire raw schema, etc.
export interface SchemaJSON {
  fields?: { [name: string]: FieldJSON | CardId };
  adoptsFrom?: CardId;
  fieldOrder?: string[];
}

export interface BaseFieldJSON {
  label?: string;
}

export interface SingularFieldJSON extends BaseFieldJSON {
  adoptsFrom: CardId;
}

export interface PluralFieldJSON extends BaseFieldJSON {
  hasMany: CardId;
}

export type FieldJSON = SingularFieldJSON | PluralFieldJSON;

export function validateSchemaJSON(json: unknown): asserts json is SchemaJSON {
  let j = json as any;
}

// Not all SchemaJSON are globally addressable, because some live inside others.
// This represents one that is globally addressable.
export interface AddressableSchemaJSON extends SchemaJSON {
  id: string;
  realm: string;
  originalRealm?: string;
}

export function validateAddressableSchemaJSON(
  json: unknown
): asserts json is AddressableSchemaJSON {
  let j = json as any;
  if (typeof j.id != 'string') {
    throw new Error(`missing id on AddressableSchemaJSON`);
  }
  if (typeof j.realm != 'string') {
    throw new Error(`missing realm on AddressableSchemaJSON`);
  }
  if ('originalRealm' in j && typeof j.originalRealm !== 'string') {
    throw new Error(`originalRealm must be a string`);
  }
  validateSchemaJSON(j);
}

export interface CardId {
  readonly id: string;
  readonly realm: string;
  readonly originalRealm?: string;
}

export interface CardLoader {
  // Go all the way from a reference to a complete (deep) Schema
  lookupSchema(id: CardId): Promise<Schema | undefined>;

  // Go from shallow, raw representation to deep, preprocessed representation
  loadSchema(json: SchemaJSON): Promise<Schema>;
}

// The full schema for a card, synchronously including all the card schema for
// its fields and ancestors and their fields, etc.
export interface Schema {
  fields(): Map<string, Schema>;
}

type Importable = string | { module: string; named: string };

interface FormatResult {
  component: Importable;
  fieldSet: string[];
}

interface CompileResult {
  isolated: FormatResult;
  embedded: FormatResult;
  edit: FormatResult;
  field: FormatResult;
}

function loadSchema(json: SchemaJSON): Promise<Schema> {}
function compiler() {}

// we're getting tangled with invalidation system concerns. Maybe we should
// sketch that out first (for both server and client use).
//
// Examples:
//   - loading the deep schema for a card
//     - shallow schema for ancestors and fields can be in json:api included,
//       and those should get targeted refresh on invalidation
//   - recompiling a given template in a card can use it (only recompile when
//     something you really use in that template has changed)
//   - user-defined computed field in the Model layer
//
//
// should synchronously invalidate for correctness, but lazily recompute for
// efficiency
//
// I think this implies that Model is not cached just its pojo, but rather as an
// actual JS module with computed functions available for when it discovers it
// has no valid cached answer
//e
// NEXT: work through the user-defined computed field case, and then try to
// generalize it to our own needs within the compiler (computing the model
// itself, and the components and fieldsets)
