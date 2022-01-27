import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { addImports, error, ImportDetails } from './utils/babel';
import { FieldMeta, PluginMeta, VALID_FIELD_DECORATORS } from './babel-plugin-card-schema-analyze';
import { CompiledCard } from './interfaces';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import { baseCardURL } from './compiler';

const processedImports = new WeakSet<NodePath<t.ImportDeclaration>>();
interface State {
  opts: {
    fields: CompiledCard['fields'];
    meta: PluginMeta;
    parent: CompiledCard;
    parentLocalName: string | undefined;
  };
}

export default function main(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        exit(path: NodePath<t.Program>, state: State) {
          let neededImports: ImportDetails = new Map();
          if (Object.keys(state.opts.fields).length > 0) {
            neededImports.set('FieldGetter', {
              moduleSpecifier: '@cardstack/core/field-getter',
              exportedName: 'default',
            });
          }

          if (neededImports.size > 0) {
            addImports(neededImports, path);
          }
        },
      },

      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        // TODO use ed's babel import util reduce the amount of work here
        // don't re-process the imports we replaced
        if (processedImports.has(path)) {
          return;
        }

        let type = cardTypeByURL(path.node.source.value, state);
        if (type === 'primitive') {
          path.remove();
        } else if (type === 'composite') {
          if (path.node.specifiers.length !== 1 || !t.isImportDefaultSpecifier(path.node.specifiers[0])) {
            throw error(path, `expecting a default import for card`);
          }
          let cardURL = path.node.source.value;
          let resolvedModule: string;
          if (cardURL === state.opts.meta.parent?.cardURL) {
            resolvedModule = state.opts.parent.schemaModule.global;
            state.opts.parentLocalName = path.node.specifiers[0].local.name;
          } else {
            let fieldMetas = fieldMetasForCardURL(cardURL, state);
            if (fieldMetas.length === 0) {
              throw error(path, `could not find fieldMeta for ${cardURL}`);
            }
            let [fieldName] = fieldMetas[0]; // all these fields share the same field card--so just use the first one
            resolvedModule = state.opts.fields[fieldName].card.schemaModule.global;
          }
          path.replaceWith(
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier(asClassName(path.node.specifiers[0].local.name)))],
              t.stringLiteral(resolvedModule)
            )
          );
        }
      },

      // TODO do we want @adopts to be transpiled into ES class extension?
      ClassDeclaration(path: NodePath<t.ClassDeclaration>, state: State) {
        if (state.opts.meta.parent?.cardURL && state.opts.parentLocalName) {
          path.node.superClass = t.identifier(asClassName(state.opts.parentLocalName));
        }
      },

      Decorator(path: NodePath<t.Decorator>) {
        // we don't want any decorators bleeding thru into our resulting classes
        path.remove();
      },

      Class(path: NodePath<t.Class>, state: State) {
        let type = cardTypeByURL(state.opts.meta.parent?.cardURL ?? baseCardURL, state);
        // you can't upgrade a primitive card to a composite card--you are
        // either a primitive card or a composite card. so if we adopt from a
        // card that is primitive, then we ourselves must be primitive as well.
        if (type === 'composite' && Object.keys(state.opts.meta.fields).length > 0) {
          path.get('body').node.body.unshift(
            // creates a private property that looks like:
            //   #getRawField;
            t.classPrivateProperty(t.privateName(t.identifier('getRawField')), null, null, false),

            // creates a constructor that looks like:
            //   constructor(get) {
            //     super(get); // when we adopt from a non-base card
            //     this.#getRawField = get;
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
                    t.memberExpression(t.thisExpression(), t.privateName(t.identifier('getRawField'))),
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
            handleClassProperty(bodyItem as NodePath<t.ClassProperty>, state, t);
          }
        }
      },
    },
  };
}

function handleClassProperty(path: NodePath<t.ClassProperty>, state: State, t: typeof Babel.types) {
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

    let type = cardTypeByFieldName(path.node.key.name, state);
    if (!type) {
      throw error(path.get('key'), `cannot find field in card`);
    }
    if (type === 'primitive') {
      transformPrimitiveField(path, t);
    } else {
      transformCompositeField(path, state, t);
    }
  }
}

// we consider a primitive card any card that has no fields
function cardTypeByURL(url: string, state: State): 'primitive' | 'composite' | undefined {
  let isParentMeta = (state.opts.meta.parent?.cardURL ?? baseCardURL) === url;
  if (isParentMeta && baseCardURL === url) {
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
//   async aboutMe() {
//     return new BioClass((innerField) => this.#getRawField("aboutMe." + innerField) )
//   }
function transformCompositeField(path: NodePath<t.ClassProperty>, state: State, t: typeof Babel.types) {
  if (!t.isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  let fieldMeta = state.opts.meta.fields[fieldName];
  path.replaceWith(
    t.classMethod(
      'method',
      t.identifier(fieldName),
      [],
      t.blockStatement([
        t.returnStatement(
          t.newExpression(t.identifier(asClassName(fieldMeta.typeDecoratorLocalName)), [
            t.arrowFunctionExpression(
              [t.identifier('innerField')],
              t.callExpression(t.memberExpression(t.thisExpression(), t.privateName(t.identifier('getRawField'))), [
                t.binaryExpression('+', t.stringLiteral(`${fieldName}.`), t.identifier('innerField')),
              ])
            ),
          ])
        ),
      ]),
      false,
      false,
      false,
      true // async = true
    )
  );
}

// creates a class method that looks like:
//   async birthdate() {
//     return new FieldGetter(this.#getRawField, "birthdate");
//   }
function transformPrimitiveField(path: NodePath<t.ClassProperty>, t: typeof Babel.types) {
  if (!t.isIdentifier(path.node.key)) {
    return;
  }

  let fieldName = path.node.key.name;
  path.replaceWith(
    t.classMethod(
      'method',
      t.identifier(fieldName),
      [],
      t.blockStatement([
        t.returnStatement(
          t.newExpression(t.identifier('FieldGetter'), [
            t.memberExpression(t.thisExpression(), t.privateName(t.identifier('getRawField'))),
            t.stringLiteral(fieldName),
          ])
        ),
      ]),
      false,
      false,
      false,
      true // async = true
    )
  );
}

// TODO There could be collisions here--take a look at Ed's util for a better
// solution
function asClassName(name: string): string {
  if (name.toLowerCase().endsWith('class')) {
    name = name.slice(0, -5);
  }
  return upperFirst(camelCase(`${name}-class`));
}
