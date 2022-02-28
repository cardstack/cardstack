import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { ImportUtil } from 'babel-import-util';
import { error, unusedClassMember } from './utils/babel';
import { FieldMeta, PluginMeta, VALID_FIELD_DECORATORS } from './babel-plugin-card-schema-analyze';
import { CompiledCard } from './interfaces';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import { BASE_CARD_URL } from './compiler';

interface State {
  importUtil: ImportUtil;
  parentLocalName: string | undefined;
  getRawFieldIdentifier: string;
  cardName: string | undefined;
  opts: {
    fields: CompiledCard['fields'];
    meta: PluginMeta;
    parent: CompiledCard;
  };
}

export default function main(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
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
        if (state.opts.meta.parent?.cardURL && state.opts.parent.schemaModule.global && state.parentLocalName) {
          let superClass = path.get('superClass') as NodePath<t.Identifier>;
          superClass.replaceWith(
            state.importUtil.import(
              superClass,
              state.opts.parent.schemaModule.global,
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
          state.cardName = path.node.id?.name;
          state.getRawFieldIdentifier = unusedClassMember(path, 'getRawField', t);
          let type = cardTypeByURL(state.opts.meta.parent?.cardURL ?? BASE_CARD_URL, state);
          // you can't upgrade a primitive card to a composite card--you are
          // either a primitive card or a composite card. so if we adopt from a
          // card that is primitive, then we ourselves must be primitive as well.
          if (type === 'composite' && Object.keys(state.opts.meta.fields).length > 0) {
            path.get('body').node.body.unshift(
              // creates a private property that looks like:
              //   getRawField;
              t.classProperty(t.identifier(state.getRawFieldIdentifier), null),

              // creates a constructor that looks like:
              //   constructor(get) {
              //     super(get); // when we adopt from a non-base card
              //     this.getRawField = get;
              //   }
              t.classMethod(
                'constructor',
                t.identifier('constructor'),
                [t.identifier('get')],
                t.blockStatement([
                  ...(state.opts.meta.parent?.cardURL
                    ? [
                        // if we extend a non base card, then add a super()
                        t.expressionStatement(t.callExpression(t.identifier('super'), [t.identifier('get')])),
                      ]
                    : []),
                  t.expressionStatement(
                    t.assignmentExpression(
                      '=',
                      t.memberExpression(t.thisExpression(), t.identifier(state.getRawFieldIdentifier)),
                      t.identifier('get')
                    )
                  ),
                ]),
                false,
                false,
                false,
                false
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
      },
    },
  };
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
      transformPrimitiveField(path, state, t);
    } else {
      transformCompositeField(path, state, t);
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
  let fieldMeta = state.opts.meta.fields[fieldName];
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
    return Object.keys(state.opts.parent.fields).length === 0 ? 'primitive' : 'composite';
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
  return Object.entries(fields).filter(([, { cardURL }]) => cardURL === url);
}

// creates a class method that looks like:
//   get aboutMe() {
//     return new BioClass((innerField) => this.getRawField("aboutMe." + innerField) )
//   }
function transformCompositeField(path: NodePath<t.ClassProperty>, state: State, t: typeof Babel.types) {
  if (!t.isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  let fieldMeta = state.opts.meta.fields[fieldName];
  path.replaceWith(
    t.classMethod(
      'get',
      t.identifier(fieldName),
      [],
      t.blockStatement([
        t.returnStatement(
          t.newExpression(
            state.importUtil.import(
              path,
              state.opts.fields[fieldName].card.schemaModule.global,
              'default',
              asClassName(fieldMeta.typeDecoratorLocalName)
            ),
            [
              t.arrowFunctionExpression(
                [t.identifier('innerField')],
                t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(state.getRawFieldIdentifier)), [
                  t.binaryExpression('+', t.stringLiteral(`${fieldName}.`), t.identifier('innerField')),
                ])
              ),
            ]
          )
        ),
      ]),
      false,
      false,
      false,
      false
    )
  );
}

// creates a class method that looks like:
//   get birthdate() {
//     return this.getRawField("birthdate");
//   }
function transformPrimitiveField(path: NodePath<t.ClassProperty>, state: State, t: typeof Babel.types) {
  if (!t.isIdentifier(path.node.key)) {
    return;
  }

  let fieldName = path.node.key.name;
  path.replaceWith(
    t.classMethod(
      'get',
      t.identifier(fieldName),
      [],
      t.blockStatement([
        t.returnStatement(
          t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(state.getRawFieldIdentifier)), [
            t.stringLiteral(fieldName),
          ])
        ),
      ]),
      false,
      false,
      false,
      false
    )
  );
}

function asClassName(name: string): string {
  if (name.toLowerCase().endsWith('class')) {
    name = name.slice(0, -5);
  }
  return upperFirst(camelCase(`${name}-class`));
}
