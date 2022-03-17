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
import { fieldsAsList } from './utils/fields';

interface State {
  importUtil: ImportUtil;
  parentLocalName: string | undefined;
  dataIdentifier: string;
  isDeserializedIdentifier: string;
  serializedMemberNames: { [fieldName: string]: string };
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
          state.serializedMemberNames = {};
          state.importUtil = new ImportUtil(babel.types, path);
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
            // we note the user provided local name for the parent card so that
            // we can provide it to babel-import-utils
            state.parentLocalName = path.node.specifiers[0].local.name;
          }

          // we'll use babel-import-utils to build the import declarations
          path.remove();
        }
      },

      // TODO do we want @adopts to be transpiled into ES class extension or
      // maybe we use composition (and perhaps use a Proxy to project the
      // composed schema's field methods)?
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
          state.isDeserializedIdentifier = unusedClassMember(path, 'isDeserialized', t);
          let type = cardTypeByURL(state.opts.meta.parent?.cardURL ?? BASE_CARD_URL, state);
          // you can't upgrade a primitive card to a composite card--you are
          // either a primitive card or a composite card. so if we adopt from a
          // card that is primitive, then we ourselves must be primitive as well.
          if (type === 'composite' && state.opts.meta.fields && keys(state.opts.meta.fields).length > 0) {
            path.get('body').node.body.unshift(
              t.classProperty(t.identifier(state.dataIdentifier), t.objectExpression([])),
              t.classProperty(t.identifier(state.isDeserializedIdentifier), t.objectExpression([])),
              t.classMethod(
                'constructor',
                t.identifier('constructor'),
                [t.identifier('rawData'), t.assignmentPattern(t.identifier('isDeserialized'), t.booleanLiteral(false))],
                t.blockStatement([
                  ...(state.opts.meta.parent?.cardURL
                    ? [babel.template.ast(`super(rawData, isDeserialized);`) as t.Statement]
                    : []),
                  babel.template(`
                    for (let [field, value] of Object.entries(rawData)) {
                      if (!%%cardClass%%.writableFields.includes(field)) {
                        continue;
                      }
                      if (isDeserialized) {
                        this[field] = value;
                      } else {
                        this[%%serializerFor%%(this, field)] = value;
                      }
                    }
                  `)({
                    serializerFor: state.importUtil.import(path, '@cardstack/core/src/utils/fields', 'serializerFor'),
                    cardClass: t.identifier(state.cardName),
                  }) as t.Statement,
                ])
              )
            );
          }

          // The ClassProperty visitor doesn't seem to work. It looks like
          // @babel/plugin-proposal-class-properties creates a "Class" visitor
          // that you need to hook into.
          for (let bodyItem of path.get('body').get('body')) {
            if (t.isClassProperty(bodyItem.node)) {
              handleClassProperty(path, bodyItem as NodePath<t.ClassProperty>, state, babel);
            }
            // TODO need to add serialized member for sync computed fields
          }
        },

        exit(path: NodePath<t.Class>, state: State) {
          addSerializeMethod(path, state, babel);
          addUsedFields(path, state, babel.types);
          addAllFields(path, state, babel.types);
          addWritableFields(path, state, babel.types);
          addSerializedMemberNames(path, state, babel.types);
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

function handleClassProperty(
  classPath: NodePath<t.Class>,
  path: NodePath<t.ClassProperty>,
  state: State,
  babel: typeof Babel
) {
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
      transformPrimitiveField(classPath, path, state, babel);
    } else {
      transformCompositeField(classPath, path, state, babel);
    }
  });
}

// TODO need to add serialized member
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

function transformCompositeField(
  classPath: NodePath<t.Class>,
  path: NodePath<t.ClassProperty>,
  state: State,
  babel: typeof Babel
) {
  let t = babel.types;
  if (!t.isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  let serializedField = (state.serializedMemberNames[fieldName] = unusedClassMember(
    classPath,
    camelCase(`serialized-${fieldName}`),
    t
  ));

  // Always make both serialized and deserialized setters fnd setters for composite fields
  makeIdentitySerializerGetter(path, fieldName, fieldName, state, babel, true);
  // TODO need a serialized getter for composite fields, probably this just
  // calls serialize() on the field's schema instance
  let newPath = makeCompositeSetter(path, fieldName, fieldName, true, state, babel);
  makeCompositeSetter(newPath, fieldName, serializedField, false, state, babel);
}

function transformPrimitiveField(
  classPath: NodePath<t.Class>,
  path: NodePath<t.ClassProperty>,
  state: State,
  babel: typeof Babel
) {
  let t = babel.types;
  if (!t.isIdentifier(path.node.key)) {
    return;
  }

  let fieldName = path.node.key.name;
  let field = state.opts.fields[fieldName];

  // always add deserialized getters and setters
  if (field.card.serializerModule) {
    makeCustomSerializerGetter(path, fieldName, fieldName, true, state, babel, true);
  } else {
    makeIdentitySerializerGetter(path, fieldName, fieldName, state, babel, true);
  }
  let deserializedSetter = makePrimitiveSetter(path, fieldName, fieldName, true, state, babel);

  // if there is a custom serializer module then make serialized getters and setters
  if (field.card.serializerModule) {
    let serializedField = (state.serializedMemberNames[fieldName] = unusedClassMember(
      classPath,
      camelCase(`serialized-${fieldName}`),
      t
    ));
    let serializedGetter = makeCustomSerializerGetter(
      deserializedSetter,
      fieldName,
      serializedField,
      false,
      state,
      babel
    );
    makePrimitiveSetter(serializedGetter, fieldName, serializedField, false, state, babel);
  }
}

function makeCompositeSetter(
  insertAfterPath: NodePath<t.ClassProperty | t.ClassMethod>,
  originalFieldName: string,
  fieldName: string,
  isDeserializedSet: boolean,
  state: State,
  babel: typeof Babel
): NodePath<t.ClassMethod> {
  let t = babel.types;
  let fieldMeta = state.opts.meta.fields![originalFieldName];
  let field = state.opts.fields[originalFieldName];
  let [newPath] = insertAfterPath.insertAfter(
    t.classMethod(
      'set',
      t.identifier(fieldName),
      [t.identifier('value')],
      t.blockStatement(
        babel.template(`
          this.%%data%%[%%fieldName%%] = new %%fieldClass%%(value${isDeserializedSet ? ', true' : ''});
          this.%%isDeserialized%%[%%fieldName%%] = ${isDeserializedSet ? 'true' : 'false'};
        `)({
          data: t.identifier(state.dataIdentifier),
          fieldName: t.stringLiteral(originalFieldName),
          isDeserialized: t.identifier(state.isDeserializedIdentifier),
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

function makePrimitiveSetter(
  insertAfterPath: NodePath<t.ClassProperty | t.ClassMethod>,
  originalFieldName: string,
  fieldName: string,
  isDeserializedSet: boolean,
  state: State,
  babel: typeof Babel
): NodePath<t.ClassMethod> {
  let t = babel.types;
  let [newPath] = insertAfterPath.insertAfter(
    t.classMethod(
      'set',
      t.identifier(fieldName),
      [t.identifier('value')],
      t.blockStatement(
        babel.template(`
          this.%%data%%[%%fieldName%%] = value;
          this.%%isDeserialized%%[%%fieldName%%] = ${isDeserializedSet ? 'true' : 'false'};
        `)({
          data: t.identifier(state.dataIdentifier),
          fieldName: t.stringLiteral(originalFieldName),
          isDeserialized: t.identifier(state.isDeserializedIdentifier),
        }) as t.Statement[]
      )
    )
  );
  return newPath;
}

function makeIdentitySerializerGetter(
  path: NodePath<t.ClassProperty | t.ClassMethod>,
  originalFieldName: string,
  fieldName: string,
  state: State,
  babel: typeof Babel,
  replace = false
): NodePath<t.ClassMethod> {
  let t = babel.types;
  let method = t.classMethod(
    'get',
    t.identifier(fieldName),
    [],
    t.blockStatement([
      babel.template(`
        return %%keySensitiveGet%%(this.%%data%%, %%fieldName%%);
      `)({
        data: t.identifier(state.dataIdentifier),
        fieldName: t.stringLiteral(originalFieldName),
        keySensitiveGet: state.importUtil.import(path, '@cardstack/core/src/utils/fields', 'keySensitiveGet'),
      }) as t.Statement,
    ])
  );
  if (replace) {
    path.replaceWith(method);
    return path as NodePath<t.ClassMethod>;
  } else {
    let [newPath] = path.insertAfter(method);
    return newPath;
  }
}

function makeCustomSerializerGetter(
  path: NodePath<t.ClassProperty | t.ClassMethod>,
  originalFieldName: string,
  fieldName: string,
  isDeserialized: boolean,
  state: State,
  babel: typeof Babel,
  replace = false
): NodePath<t.ClassMethod> {
  let t = babel.types;
  let field = state.opts.fields[originalFieldName];
  let method = t.classMethod(
    'get',
    t.identifier(fieldName),
    [],
    t.blockStatement(
      babel.template(`
          let value = %%keySensitiveGet%%(this.%%data%%, %%fieldName%%);
          if (${isDeserialized ? '' : '!'}this.%%isDeserialized%%[%%fieldName%%]) {
            return value;
          }
          return %%serializerModule%%.${isDeserialized ? 'deserialize' : 'serialize'}(value);
        `)({
        data: t.identifier(state.dataIdentifier),
        fieldName: t.stringLiteral(originalFieldName),
        isDeserialized: t.identifier(state.isDeserializedIdentifier),
        keySensitiveGet: state.importUtil.import(path, '@cardstack/core/src/utils/fields', 'keySensitiveGet'),
        serializerModule: state.importUtil.import(
          path,
          field.card.serializerModule!.global,
          '*',
          `${capitalize(field.card.url.split('/')[field.card.url.split('/').length - 1])}Serializer`
        ),
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

function addUsedFields(path: NodePath<t.Class>, state: State, t: typeof Babel.types) {
  addStaticProperty(
    path,
    'usedFields',
    t.objectExpression(
      Object.entries(state.opts.componentInfos).map(([format, info]) =>
        t.objectProperty(
          t.identifier(format),
          t.arrayExpression((info?.usedFields ?? []).map((f) => t.stringLiteral(f)))
        )
      )
    ),
    t
  );
}

function addAllFields(path: NodePath<t.Class>, state: State, t: typeof Babel.types) {
  addStaticProperty(
    path,
    'allFields',
    t.arrayExpression(fieldsAsList(state.opts.fields).map(([f]) => t.stringLiteral(f))),
    t
  );
}

function addWritableFields(path: NodePath<t.Class>, state: State, t: typeof Babel.types) {
  addStaticProperty(
    path,
    'writableFields',
    t.arrayExpression(
      Object.entries(state.opts.fields)
        .filter(([, field]) => !field.computed)
        .map(([fieldName]) => t.stringLiteral(fieldName))
    ),
    t
  );
}

function addSerializedMemberNames(path: NodePath<t.Class>, state: State, t: typeof Babel.types) {
  addStaticProperty(
    path,
    'serializedMemberNames',
    t.objectExpression(
      Object.entries(state.serializedMemberNames).map(([field, assignedName]) =>
        t.objectProperty(t.identifier(field), t.stringLiteral(assignedName))
      )
    ),
    t
  );
}

function addSerializeMethod(path: NodePath<t.Class>, state: State, babel: typeof Babel) {
  let t = babel.types;
  let body = path.get('body');
  body.node.body.unshift(
    t.classMethod(
      'method',
      t.identifier('serialize'),
      ['instance', 'format'].map((name) => t.identifier(name)),
      t.blockStatement(
        babel.template(`
          let fields = format === 'all' ? %%cardClass%%.allFields : %%cardClass%%.usedFields[format] ?? [];
          return %%getSerializedProperties%%(instance, fields);
        `)({
          cardClass: t.identifier(state.cardName),
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

function addStaticProperty(path: NodePath<t.Class>, name: string, expression: t.Expression, t: typeof Babel.types) {
  let body = path.get('body');
  body.node.body.unshift(
    t.classProperty(
      t.identifier(name),
      expression,
      undefined,
      undefined,
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
