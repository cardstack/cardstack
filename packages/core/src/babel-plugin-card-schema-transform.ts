import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { ImportUtil } from 'babel-import-util';
import { error, unusedClassMember } from './utils/babel';
import { FieldMeta, FileMeta, VALID_FIELD_DECORATORS } from './babel-plugin-card-file-analyze';
import { CompiledCard, ComponentInfo, Field, ModuleRef } from './interfaces';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import capitalize from 'lodash/capitalize';
import { BASE_CARD_URL } from './compiler';
import { keys } from './utils';

interface State {
  importUtil: ImportUtil;
  parentLocalName: string | undefined;
  dataIdentifier: string;
  loadedFieldsIdentifier: string;
  serializedDataIdentifier: string;
  isCompleteIdentifier: string;
  cardName: string;
  opts: Options;
}

export interface Options {
  fields: CompiledCard['fields'];
  meta: FileMeta;
  parent: CompiledCard | undefined;
  componentInfos: Partial<Record<'isolated' | 'embedded' | 'edit', ComponentInfo<ModuleRef>>>;
}

export default function main(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          state.importUtil = new ImportUtil(babel.types, path);
        },
        exit(path: NodePath<t.Program>, state: State) {
          addUsedFields(path, state, babel);
          addAllFields(path, state, babel);
          addWritableFields(path, state, babel);
        },
      },

      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        let type = cardTypeByURL(path.node.source.value, state);
        if (type === 'primitive') {
          path.remove();
        } else if (type === 'composite') {
          if (path.node.specifiers.length !== 1 || !t.isImportDefaultSpecifier(path.node.specifiers[0])) {
            throw error(path, `expecting a default import for card`);
          }

          if (path.node.source.value === state.opts.meta.parent?.cardURL) {
            state.parentLocalName = path.node.specifiers[0].local.name;
          }
          path.remove();
        }
      },

      ClassDeclaration(path: NodePath<t.ClassDeclaration>, state: State) {
        if (state.opts.meta.parent?.cardURL && state.opts.parent?.schemaModule.global && state.parentLocalName) {
          let superClass = path.get('superClass') as NodePath<t.Identifier>;
          superClass.replaceWith(
            state.importUtil.import(
              superClass,
              state.opts.parent?.schemaModule.global,
              'default',
              asClassName(state.parentLocalName)
            )
          );
        }
      },

      Decorator(path: NodePath<t.Decorator>) {
        // we don't want any decorators bleeding thru into our resulting classes
        path.remove();
      },

      Class: {
        enter(path: NodePath<t.Class>, state: State) {
          if (!path.node.id?.name) {
            throw error(path, `missing a class name for the card`);
          }
          state.cardName = path.node.id.name;
          state.dataIdentifier = unusedClassMember(path, 'data', t);
          state.serializedDataIdentifier = unusedClassMember(path, 'serializedData', t);
          state.isCompleteIdentifier = unusedClassMember(path, 'isComplete', t);
          state.loadedFieldsIdentifier = unusedClassMember(path, 'loadedFields', t);
          let type = cardTypeByURL(state.opts.meta.parent?.cardURL ?? BASE_CARD_URL, state);
          // you can't upgrade a primitive card to a composite card--you are
          // either a primitive card or a composite card. so if we adopt from a
          // card that is primitive, then we ourselves must be primitive as well.
          if (type === 'composite' && state.opts.meta.fields && keys(state.opts.meta.fields).length > 0) {
            path.get('body').node.body.unshift(
              t.classProperty(t.identifier(state.dataIdentifier), t.objectExpression([])),
              t.classProperty(t.identifier(state.serializedDataIdentifier), t.objectExpression([])),
              t.classProperty(t.identifier(state.loadedFieldsIdentifier), t.arrayExpression([])),
              t.classProperty(t.identifier(state.isCompleteIdentifier)),
              t.classMethod(
                'constructor',
                t.identifier('constructor'),
                [
                  t.identifier('rawData'),
                  t.identifier('makeComplete'),
                  t.assignmentPattern(t.identifier('isDeserialized'), t.booleanLiteral(false)),
                ],
                t.blockStatement([
                  ...(state.opts.meta.parent?.cardURL
                    ? [babel.template.ast(`super(rawData, makeComplete, isDeserialized);`) as t.Statement]
                    : []),
                  ...(babel.template(`
                    this.%%loadedFields%% = makeComplete ? allFields : %%flattenData%%(rawData).map(([fieldName]) => fieldName);
                    this.%%isComplete%% = makeComplete;
                    for (let [field, value] of Object.entries(rawData)) {
                      if (!writableFields.includes(field)) {
                        continue;
                      }
                      if (isDeserialized) {
                        this[field] = value;
                      } else {
                        %%cardClass%%.serializedSet(this, field, value);
                      }
                    }
                  `)({
                    cardClass: t.identifier(state.cardName),
                    loadedFields: t.identifier(state.loadedFieldsIdentifier),
                    isComplete: t.identifier(state.isCompleteIdentifier),
                    flattenData: state.importUtil.import(path, '@cardstack/core/src/utils/fields', 'flattenData'),
                  }) as t.Statement[]),
                ])
              )
            );
          }

          // The ClassProperty visitor doesn't seem to work. It looks like
          // @babel/plugin-proposal-class-properties creates a "Class" visitor
          // that you need to hook into.
          for (let bodyItem of path.get('body').get('body')) {
            if (t.isClassProperty(bodyItem.node)) {
              handleClassProperty(bodyItem as NodePath<t.ClassProperty>, state, babel);
            }
          }
        },

        exit(path: NodePath<t.Class>, state: State) {
          addLoadedFieldsMethod(path, state, babel);
          addHasFieldMethod(path, state, babel);
          addSerializeMethod(path, state, babel);
          addSerializedGetMethod(path, state, babel);
          addSerializedSetMethod(path, state, babel);
        },
      },
    },
  };
}

export function getFieldForPath(fields: CompiledCard['fields'], path: string): Field | undefined {
  let paths = path.split('.');
  let [first, ...tail] = paths;
  let field = fields[first];
  if (paths.length > 1) {
    return getFieldForPath(field.card.fields, tail.join('.'));
  }
  return field;
}

function handleClassProperty(path: NodePath<t.ClassProperty>, state: State, babel: typeof Babel) {
  let t = babel.types;
  forEachValidFieldDecorator(path, t, (p) => {
    let path = p as NodePath<t.ClassProperty>;
    if (!t.isIdentifier(path.node.key)) {
      return;
    }
    let fieldName = path.node.key.name;
    let type = cardTypeByFieldName(fieldName, state);
    if (!type) {
      throw error(path.get('key'), `cannot find field in card`);
    }

    let meta = state.opts.meta.fields[fieldName];
    if (meta.computed && meta.computeVia) {
      transformAsyncComputedField(path, state, babel);
    } else if (type === 'primitive') {
      transformPrimitiveField(path, state, babel);
    } else {
      transformCompositeField(path, state, babel);
    }
  });
}

function transformAsyncComputedField(path: NodePath<t.ClassProperty>, state: State, babel: typeof Babel) {
  let t = babel.types;
  if (!t.isIdentifier(path.node.key)) {
    return;
  }
  let classPath = path.parentPath.parentPath as NodePath<t.Class>;
  let fieldName = path.node.key.name;
  let cachedName = unusedClassMember(classPath, `_${camelCase('cached-' + fieldName)}`, t);
  let fieldMeta = state.opts.meta.fields![fieldName];
  let computeVia = fieldMeta.computeVia;
  if (!computeVia) {
    throw error(path, `missing computeVia for async computed field ${fieldName}`);
  }

  path.insertBefore(t.classProperty(t.identifier(cachedName), null));

  path.replaceWith(
    t.classMethod(
      'get',
      t.identifier(fieldName),
      [],
      t.blockStatement([
        // this.cachedName is a 3 state variable, where undefined means
        // we haven't cached it and null means it has no value
        babel.template(`
          if (this.%%cachedName%% !== undefined) {
            return this.%%cachedName%%;
          } else {
            throw new %%NotReady%%(%%schemaInstance%%, %%fieldName%%, %%computeVia%%, %%cachedNameMember%%, %%cardName%%);
          }
        `)({
          schemaInstance: t.thisExpression(),
          cachedName: t.identifier(cachedName),
          cachedNameMember: t.stringLiteral(cachedName),
          NotReady: state.importUtil.import(path, '@cardstack/core/src/utils/errors', 'NotReady'),
          fieldName: t.stringLiteral(fieldName),
          computeVia: t.stringLiteral(computeVia),
          cardName: t.stringLiteral(state.cardName ?? '<unknown>'), // this param is for a nice error message if we ever see this in the wild
        }) as t.Statement,
      ])
    )
  );
}

function forEachValidFieldDecorator(
  path: NodePath<t.ClassMethod | t.ClassProperty>,
  t: typeof Babel.types,
  cb: (path: NodePath<t.ClassMethod | t.ClassProperty>) => void
) {
  if (!t.isIdentifier(path.node.key)) {
    return;
  }

  let decorators = path.node.decorators;
  if (
    decorators?.length === 0 ||
    !decorators?.find(
      (d) =>
        t.isCallExpression(d.expression) &&
        t.isIdentifier(d.expression.callee) &&
        Object.keys(VALID_FIELD_DECORATORS).includes(d.expression.callee.name)
    )
  ) {
    return;
  }

  for (let decoratorPath of path.get('decorators') as NodePath<t.Decorator>[]) {
    let decorator = decoratorPath.node;
    if (
      !t.isCallExpression(decorator.expression) ||
      !t.isIdentifier(decorator.expression.callee) ||
      !Object.keys(VALID_FIELD_DECORATORS).includes(decorator.expression.callee.name)
    ) {
      continue;
    }

    cb(path);
  }
}

// we consider a primitive card any card that has no fields
function cardTypeByURL(url: string, state: State): 'primitive' | 'composite' | undefined {
  let isParentMeta = (state.opts.meta.parent?.cardURL ?? BASE_CARD_URL) === url;
  if (isParentMeta && BASE_CARD_URL === url) {
    return 'composite'; // a base card, while having no fields is actually the stem for all composite cards
  } else if (isParentMeta) {
    // casting because the only falsy case is expected to be the base card
    return Object.keys(state.opts.parent!.fields).length === 0 ? 'primitive' : 'composite';
  }

  let fieldMetas = fieldMetasForCardURL(url, state);
  if (fieldMetas.length === 0 && !isParentMeta) {
    return;
  }

  // all these fields share the same field card--so just use the first one
  let [fieldName] = fieldMetas[0];
  let fieldCard = state.opts.fields[fieldName].card;
  return Object.keys(fieldCard.fields).length === 0 ? 'primitive' : 'composite';
}

function cardTypeByFieldName(fieldName: string, state: State): 'primitive' | 'composite' | undefined {
  let fieldCard = state.opts.fields[fieldName]?.card;
  if (!fieldCard) {
    return;
  }
  return Object.keys(fieldCard.fields).length === 0 ? 'primitive' : 'composite';
}

function fieldMetasForCardURL(url: string, state: State): [string, FieldMeta][] {
  let { fields } = state.opts.meta;
  return Object.entries(fields!).filter(([, { cardURL }]) => cardURL === url);
}

function transformCompositeField(path: NodePath<t.ClassProperty>, state: State, babel: typeof Babel) {
  let t = babel.types;
  if (!t.isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  makeFieldGetter({ path, fieldName, state, babel, replace: true });
  makeCompositeSetter({
    insertAfterPath: path,
    fieldName,
    state,
    babel,
  });
}

function transformPrimitiveField(path: NodePath<t.ClassProperty>, state: State, babel: typeof Babel) {
  let t = babel.types;
  if (!t.isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  makeFieldGetter({ path, fieldName, state, babel, replace: true });
  makePrimitiveSetter({
    insertAfterPath: path,
    fieldName,
    setterName: fieldName,
    state,
    babel,
  });
}

function addSerializedGetMethod(path: NodePath<t.Class>, state: State, babel: typeof Babel) {
  let t = babel.types;
  let body = path.get('body');
  let fieldsWithCustomSerialization = Object.entries(state.opts.fields)
    .filter(([, field]) => field.card.serializerModule)
    .map(
      ([fieldName, field]) =>
        babel.template(`
          if (field === %%fieldName%% && value !== null) {
            value = %%serializerModule%%.serialize(value);
          }
        `)({
          fieldName: t.stringLiteral(fieldName),
          serializerModule: state.importUtil.import(
            path,
            field.card.serializerModule!.global,
            '*',
            `${capitalize(field.card.url.split('/')[field.card.url.split('/').length - 1])}Serializer`
          ),
        }) as t.Statement
    );

  let compositeFields = Object.entries(state.opts.fields)
    .filter(([, field]) => Object.keys(field.card.fields).length > 0)
    .map(
      ([fieldName, field]) =>
        babel.template(`
        if (field === %%fieldName%% && value !== null) {
          let fields = %%getFieldsAtPath%%(field, instance.%%loadedFields%%);
          value = %%fieldClass%%.serialize(value, fields);
        }
      `)({
          fieldName: t.stringLiteral(fieldName),
          loadedFields: t.identifier(state.loadedFieldsIdentifier),
          getFieldsAtPath: state.importUtil.import(body, '@cardstack/core/src/utils/fields', 'getFieldsAtPath'),
          fieldClass: state.importUtil.import(
            path,
            field.card.schemaModule.global,
            'default',
            asClassName(
              state.opts.meta.fields[fieldName]?.typeDecoratorLocalName ??
                state.opts.fields[fieldName].card.url.split('/').pop()
            )
          ),
        }) as t.Statement
    );

  body.node.body.unshift(
    t.classMethod(
      'method',
      t.identifier('serializedGet'),
      ['instance', 'field'].map((name) => t.identifier(name)),
      t.blockStatement(
        babel.template(`
          if (field in instance.%%serializedData%%) {
            return instance.%%serializedData%%[field];
          }
          let value = instance[field];
          %%fieldsWithCustomSerialization%%
          %%compositeFields%%
          instance.%%serializedData%%[field] = value;
          return value;
        `)({
          fieldsWithCustomSerialization:
            fieldsWithCustomSerialization.length > 0 ? fieldsWithCustomSerialization : t.emptyStatement(),
          compositeFields: compositeFields.length > 0 ? compositeFields : t.emptyStatement(),
          serializedData: t.identifier(state.serializedDataIdentifier),
        }) as t.Statement[]
      ),
      false,
      true // static
    )
  );
}

function addSerializedSetMethod(path: NodePath<t.Class>, state: State, babel: typeof Babel) {
  let t = babel.types;
  let body = path.get('body');

  body.node.body.unshift(
    t.classMethod(
      'method',
      t.identifier('serializedSet'),
      ['instance', 'field', 'value'].map((name) => t.identifier(name)),
      t.blockStatement(
        babel.template(`
          delete instance.%%data%%[field];
          instance.%%serializedData%%[field] = value;
        `)({
          data: t.identifier(state.dataIdentifier),
          serializedData: t.identifier(state.serializedDataIdentifier),
        }) as t.Statement[]
      ),
      false,
      true // static
    )
  );
}

function makeCompositeSetter({
  insertAfterPath,
  fieldName,
  state,
  babel,
}: {
  insertAfterPath: NodePath<t.ClassProperty | t.ClassMethod>;
  fieldName: string;
  state: State;
  babel: typeof Babel;
}): NodePath<t.ClassMethod> {
  let t = babel.types;
  let fieldMeta = state.opts.meta.fields![fieldName];
  let field = state.opts.fields[fieldName];
  let [newPath] = insertAfterPath.insertAfter(
    t.classMethod(
      'set',
      t.identifier(fieldName),
      [t.identifier('value')],
      t.blockStatement(
        babel.template(`
          delete this.%%serializedData%%[%%fieldName%%];
          let fields = %%getFieldsAtPath%%(%%fieldName%%, this.%%loadedFields%%);
          this.%%data%%[%%fieldName%%] = new %%fieldClass%%(value, this.%%isComplete%%, true);
        `)({
          data: t.identifier(state.dataIdentifier),
          fieldName: t.stringLiteral(fieldName),
          isComplete: t.identifier(state.isCompleteIdentifier),
          serializedData: t.identifier(state.serializedDataIdentifier),
          loadedFields: t.identifier(state.loadedFieldsIdentifier),
          getFieldsAtPath: state.importUtil.import(
            insertAfterPath,
            '@cardstack/core/src/utils/fields',
            'getFieldsAtPath'
          ),
          fieldClass: state.importUtil.import(
            insertAfterPath,
            field.card.schemaModule.global,
            'default',
            asClassName(fieldMeta.typeDecoratorLocalName)
          ),
        }) as t.Statement[]
      )
    )
  );
  return newPath;
}

function makePrimitiveSetter({
  insertAfterPath,
  fieldName,
  setterName,
  state,
  babel,
}: {
  insertAfterPath: NodePath<t.ClassProperty | t.ClassMethod>;
  fieldName: string;
  setterName: string;
  state: State;
  babel: typeof Babel;
}): NodePath<t.ClassMethod> {
  let t = babel.types;
  let [newPath] = insertAfterPath.insertAfter(
    t.classMethod(
      'set',
      t.identifier(setterName),
      [t.identifier('value')],
      t.blockStatement(
        babel.template(`
          delete this.%%serializedData%%[%%fieldName%%];
          this.%%data%%[%%fieldName%%] = value;
        `)({
          data: t.identifier(state.dataIdentifier),
          fieldName: t.stringLiteral(fieldName),
          serializedData: t.identifier(state.serializedDataIdentifier),
        }) as t.Statement[]
      )
    )
  );
  return newPath;
}

function makeFieldGetter({
  path,
  fieldName,
  state,
  babel,
  replace = false,
}: {
  path: NodePath<t.ClassProperty | t.ClassMethod>;
  fieldName: string;
  state: State;
  babel: typeof Babel;
  replace?: boolean;
}): NodePath<t.ClassMethod> {
  let t = babel.types;
  let field = state.opts.fields[fieldName];
  let fieldMeta = state.opts.meta.fields![fieldName];
  let getFromDeserializedData: t.Statement;

  if (Object.keys(field.card.fields).length > 0) {
    // getter for composite field
    getFromDeserializedData = babel.template(`
      if (%%fieldName%% in this.%%serializedData%% || this.isComplete) {
        let fields = %%getFieldsAtPath%%(%%fieldName%%, this.%%loadedFields%%);
        let value = this.%%serializedData%%[%%fieldName%%] || {};
        value = new %%fieldClass%%(value, this.%%isComplete%%);
        this.%%data%%[%%fieldName%%] = value;
        return value;
      }
    `)({
      data: t.identifier(state.dataIdentifier),
      fieldName: t.stringLiteral(fieldName),
      isComplete: t.identifier(state.isCompleteIdentifier),
      serializedData: t.identifier(state.serializedDataIdentifier),
      loadedFields: t.identifier(state.loadedFieldsIdentifier),
      getFieldsAtPath: state.importUtil.import(path, '@cardstack/core/src/utils/fields', 'getFieldsAtPath'),
      fieldClass: state.importUtil.import(
        path,
        field.card.schemaModule.global,
        'default',
        asClassName(fieldMeta.typeDecoratorLocalName)
      ),
    }) as t.Statement;
  } else if (field.card.serializerModule) {
    // getter for field with custom serializer
    getFromDeserializedData = babel.template(`
      if (%%fieldName%% in this.%%serializedData%%) {
        let value = this.%%serializedData%%[%%fieldName%%];
        if (value !== null) {
          value = %%serializerModule%%.deserialize(value);
        }
        this.%%data%%[%%fieldName%%] = value;
        return value;
      }
    `)({
      data: t.identifier(state.dataIdentifier),
      fieldName: t.stringLiteral(fieldName),
      serializedData: t.identifier(state.serializedDataIdentifier),
      serializerModule: state.importUtil.import(
        path,
        field.card.serializerModule!.global,
        '*',
        `${capitalize(field.card.url.split('/')[field.card.url.split('/').length - 1])}Serializer`
      ),
    }) as t.Statement;
  } else {
    // getter for primitive field with no custom serializer
    getFromDeserializedData = babel.template(`
      if (%%fieldName%% in this.%%serializedData%%) {
        return this.%%serializedData%%[%%fieldName%%];
      }
    `)({
      fieldName: t.stringLiteral(fieldName),
      serializedData: t.identifier(state.serializedDataIdentifier),
    }) as t.Statement;
  }

  let method = t.classMethod(
    'get',
    t.identifier(fieldName),
    [],
    t.blockStatement(
      babel.template(`
        if (%%fieldName%% in this.%%data%%) {
          return this.%%data%%[%%fieldName%%];
        }
        %%getFromDeserializedData%%
        if (!this.%%isComplete%%) {
          throw new Error(%%errorMessage%%);
        }
        return null;
      `)({
        data: t.identifier(state.dataIdentifier),
        fieldName: t.stringLiteral(fieldName),
        isComplete: t.identifier(state.isCompleteIdentifier),
        errorMessage: t.stringLiteral(`TODO: ${fieldName}`),
        getFromDeserializedData,
      }) as t.Statement[]
    )
  );
  if (replace) {
    path.replaceWith(method);
    return path as NodePath<t.ClassMethod>;
  } else {
    let [newPath] = path.insertAfter(method);
    return newPath;
  }
}

function addUsedFields(path: NodePath<t.Program>, state: State, babel: typeof Babel) {
  let t = babel.types;
  path.node.body.push(
    babel.template(`const usedFields = %%usedFields%%;`)({
      usedFields: t.objectExpression(
        Object.entries(state.opts.componentInfos).map(([format, info]) =>
          t.objectProperty(
            t.identifier(format),
            t.arrayExpression((info?.usedFields ?? []).map((f) => t.stringLiteral(f)))
          )
        )
      ),
    }) as t.Statement
  );
}

function addAllFields(path: NodePath<t.Program>, state: State, babel: typeof Babel) {
  let t = babel.types;
  path.node.body.push(
    babel.template(`const allFields = %%allFields%%;`)({
      allFields: t.arrayExpression(fieldsAsList(state.opts.fields).map(([f]) => t.stringLiteral(f))),
    }) as t.Statement
  );
}

function addWritableFields(path: NodePath<t.Program>, state: State, babel: typeof Babel) {
  let t = babel.types;
  path.node.body.push(
    babel.template(`const writableFields = %%writableFields%%;`)({
      writableFields: t.arrayExpression(
        Object.entries(state.opts.fields)
          .filter(([, field]) => !field.computed)
          .map(([fieldName]) => t.stringLiteral(fieldName))
      ),
    }) as t.Statement
  );
}

function addSerializeMethod(path: NodePath<t.Class>, state: State, babel: typeof Babel) {
  let t = babel.types;
  let body = path.get('body');
  body.node.body.unshift(
    t.classMethod(
      'method',
      t.identifier('serialize'),
      ['instance', 'fieldsOrFormat'].map((name) => t.identifier(name)),
      t.blockStatement(
        babel.template(`
          let fields;
          if (typeof fieldsOrFormat === 'string') {
            fields = fieldsOrFormat === 'all' ? allFields : usedFields[fieldsOrFormat] ?? [];
          } else if (Array.isArray(fieldsOrFormat)) {
            fields = [...fieldsOrFormat];
          } else {
            throw new Error('fieldsOrFormat must be a string or an array');
          }
          return %%getSerializedProperties%%(instance, fields);
        `)({
          getSerializedProperties: state.importUtil.import(
            body,
            '@cardstack/core/src/utils/fields',
            'getSerializedProperties'
          ),
        }) as t.Statement[]
      ),
      false,
      true // static
    )
  );
}

function addHasFieldMethod(path: NodePath<t.Class>, _state: State, babel: typeof Babel) {
  let t = babel.types;
  path.get('body').node.body.unshift(
    t.classMethod(
      'method',
      t.identifier('hasField'),
      [t.identifier('field')],
      t.blockStatement([babel.template.ast(`return allFields.includes(field);`) as t.Statement]),
      false,
      true // static
    )
  );
}

function addLoadedFieldsMethod(path: NodePath<t.Class>, state: State, babel: typeof Babel) {
  let t = babel.types;
  path.get('body').node.body.unshift(
    t.classMethod(
      'method',
      t.identifier('loadedFields'),
      [t.identifier('schemaInstance')],
      t.blockStatement([
        babel.template(`return [...schemaInstance.%%loadedFields%%];`)({
          loadedFields: t.identifier(state.loadedFieldsIdentifier),
        }) as t.Statement,
      ]),
      false,
      true // static
    )
  );
}

function asClassName(name: string): string {
  if (name.toLowerCase().endsWith('class')) {
    name = name.slice(0, -5);
  }
  return upperFirst(camelCase(`${name}-class`));
}

function fieldsAsList(fields: { [key: string]: Field }, path: string[] = []): [string, Field][] {
  let fieldList: [string, Field][] = [];
  for (let [fieldName, field] of Object.entries(fields)) {
    if (Object.keys(field.card.fields).length === 0) {
      fieldList.push([[...path, fieldName].join('.'), field]);
    } else {
      fieldList = [...fieldList, ...fieldsAsList(field.card.fields, [...path, fieldName])];
    }
  }
  return fieldList;
}
