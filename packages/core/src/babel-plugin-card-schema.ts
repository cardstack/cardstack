import {
  ImportDeclaration,
  isImportSpecifier,
  identifier,
  callExpression,
  isDecorator,
  stringLiteral,
  isStringLiteral,
  isIdentifier,
  CallExpression,
  isCallExpression,
  isClassDeclaration,
  ClassProperty,
  Decorator,
  classMethod,
  blockStatement,
  returnStatement,
  awaitExpression,
  memberExpression,
  thisExpression,
  privateName,
  expressionStatement,
  assignmentExpression,
  classPrivateProperty,
  isClassProperty,
  Class,
  isClassMethod,
  ClassMethod,
  newExpression,
  arrowFunctionExpression,
  binaryExpression,
  importDeclaration,
  isImportDefaultSpecifier,
  importDefaultSpecifier,
} from '@babel/types';
import { NodePath } from '@babel/traverse';
import { name, error } from './utils/babel';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';

const VALID_FIELD_DECORATORS = {
  linksTo: true,
  contains: true,
  containsMany: true,
};
type FieldType = keyof typeof VALID_FIELD_DECORATORS;

export interface FieldMeta {
  cardURL: string;
  type: FieldType;
  typeDecoratorLocalName: string;
}
export interface FieldsMeta {
  [name: string]: FieldMeta;
}
export interface ParentMeta {
  cardURL: string;
}

export interface PluginMeta {
  fields: FieldsMeta;
  parent?: ParentMeta;
}

interface State {
  opts: any;
}

export function getMeta(obj: State['opts']): PluginMeta {
  let meta = metas.get(obj);
  if (!meta) {
    // throw new Error(
    //   `tried to getMeta for something that was not passed as card-babel-plugin's options`
    // );
    // NOTE: Base cards, like string, don't have fields. Feels like it should not error
    return { fields: {} };
  }
  return meta;
}

const metas = new WeakMap<
  State['opts'],
  {
    parent?: ParentMeta;
    fields: FieldsMeta;
  }
>();

const processedImports = new WeakSet<NodePath<ImportDeclaration>>();

export default function main() {
  return {
    visitor: {
      ImportDeclaration: {
        enter(path: NodePath<ImportDeclaration>, state: State) {
          if (path.node.source.value === '@cardstack/types') {
            storeMeta(state.opts, path);
            path.remove();
          }
        },
        exit(path: NodePath<ImportDeclaration>, state: State) {
          // don't re-process the imports we fixed up
          if (processedImports.has(path)) {
            return;
          }

          let metas = fieldMetasForCardURL(path.node.source.value, state);
          if (isPrimitiveCard(path.node.source.value)) {
            path.remove();
          } else if (metas.length > 0) {
            if (path.node.specifiers.length !== 1 || !isImportDefaultSpecifier(path.node.specifiers[0])) {
              throw error(path, `expecting a default import for card`);
            }
            let fieldClass = asClassName(path.node.specifiers[0].local.name);

            path.replaceWith(
              importDeclaration(
                [importDefaultSpecifier(identifier(fieldClass))],
                // Question: how to we get a card's defined module name in a
                // synchronous manner? Maybe this is actually a 2 pass process?
                // Where we perform resolution on the card's defined modules in
                // between the 2 passes?
                stringLiteral(path.node.source.value)
              )
            );
          }
          processedImports.add(path);
        },
      },

      Class(path: NodePath<Class>, state: State) {
        path.get('body').node.body.unshift(
          // creates a private property that looks like:
          //   #getRawField;
          classPrivateProperty(privateName(identifier('getRawField')), null, null, false),

          // creates a constructor that looks like:
          //   constructor(get) {
          //     this.#getRawField = get;
          //   }
          classMethod(
            'constructor',
            identifier('constructor'),
            [identifier('get')],
            blockStatement([
              expressionStatement(
                assignmentExpression(
                  '=',
                  memberExpression(thisExpression(), privateName(identifier('getRawField'))),
                  identifier('get')
                )
              ),
            ]),
            false,
            false,
            false,
            false
          )
        );

        // The ClassProperty visitor doesn't seem to work. It looks like
        // @babel/plugin-proposal-class-properties creates a "Class" visitor
        // that you need to hook into.
        for (let bodyItem of path.get('body').get('body')) {
          if (isClassProperty(bodyItem.node)) {
            handleClassProperty(bodyItem as NodePath<ClassProperty>, state);
          } else if (isClassMethod(bodyItem.node)) {
            handleClassMethod(bodyItem as NodePath<ClassMethod>);
          }
        }
      },
    },
  };
}

function handleClassMethod(path: NodePath<ClassMethod>) {
  if (path.node.kind === 'constructor') {
    return;
  }
  let decorators = path.get('decorators') as NodePath<Decorator>[];
  for (let decorator of decorators) {
    if (
      isCallExpression(decorator.node.expression) &&
      isIdentifier(decorator.node.expression.callee) &&
      Object.keys(VALID_FIELD_DECORATORS).includes(decorator.node.expression.callee.name)
    ) {
      decorator.remove();
    }
  }
}

function handleClassProperty(path: NodePath<ClassProperty>, state: State) {
  if (!isIdentifier(path.node.key)) {
    return;
  }

  let decorators = path.node.decorators;
  if (
    decorators?.length === 0 ||
    !decorators?.find(
      (d) =>
        isCallExpression(d.expression) &&
        isIdentifier(d.expression.callee) &&
        Object.keys(VALID_FIELD_DECORATORS).includes(d.expression.callee.name)
    )
  ) {
    return;
  }

  for (let decoratorPath of path.get('decorators') as NodePath<Decorator>[]) {
    let decorator = decoratorPath.node;
    if (
      !isCallExpression(decorator.expression) ||
      !isIdentifier(decorator.expression.callee) ||
      !Object.keys(VALID_FIELD_DECORATORS).includes(decorator.expression.callee.name)
    ) {
      continue;
    }

    let { fields } = getMeta(state.opts);
    let fieldMeta = fields[path.node.key.name];
    if (!fieldMeta) {
      throw new Error(`field ${path.node.key.name} not found in fields meta`);
    }

    if (isPrimitiveCard(fieldMeta.cardURL)) {
      transformPrimitiveField(path);
    } else {
      transformCompositeField(path, fieldMeta);
    }
  }
}

// We need to figure out how we know its a primitive. Perhaps it's a
// primitive because the decorator's argument's declaration comes from the
// base realm? Ed was suggesting that the https://cardstack.com/base/string
// module could actually include something to indicate it's a
// primitive--however, at compile time we aren't evaluating the field card's
// implementation, right? like we wouldn't evaluate "http://demo/cards/bio"
// to see if it is a primitive...
function isPrimitiveCard(url: string) {
  return url.startsWith('https://cardstack.com/base/');
}

function fieldMetasForCardURL(url: string, state: State): [string, FieldMeta][] {
  let { fields } = getMeta(state.opts);
  return Object.entries(fields).filter(([, { cardURL }]) => cardURL === url);
}

// creates a class method that looks like:
//   async aboutMe() {
//     return new BioClass((innerField) => this.#getRawField("aboutMe." + innerField) )
//   }
function transformCompositeField(path: NodePath<ClassProperty>, fieldMeta: FieldMeta) {
  if (!isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  let fieldClass = asClassName(fieldMeta.typeDecoratorLocalName);

  path.replaceWith(
    classMethod(
      'method',
      identifier(fieldName),
      [],
      blockStatement([
        returnStatement(
          newExpression(identifier(fieldClass), [
            arrowFunctionExpression(
              [identifier('innerField')],
              callExpression(memberExpression(thisExpression(), privateName(identifier('getRawField'))), [
                binaryExpression('+', stringLiteral(`${fieldName}.`), identifier('innerField')),
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
//     return await this.#getRawField('birthdate');
//   }
function transformPrimitiveField(path: NodePath<ClassProperty>) {
  if (!isIdentifier(path.node.key)) {
    return;
  }

  let fieldName = path.node.key.name;
  path.replaceWith(
    classMethod(
      'method',
      identifier(fieldName),
      [],
      blockStatement([
        returnStatement(
          awaitExpression(
            callExpression(memberExpression(thisExpression(), privateName(identifier('getRawField'))), [
              stringLiteral(fieldName),
            ])
          )
        ),
      ]),
      false,
      false,
      false,
      true // async = true
    )
  );
}

function storeMeta(key: State['opts'], path: NodePath<ImportDeclaration>) {
  let fields: FieldsMeta = {};
  let parent: ParentMeta | undefined;
  for (let specifier of path.node.specifiers) {
    // all our field-defining decorators are named exports
    if (!isImportSpecifier(specifier)) {
      return;
    }
    let {
      local: { name: fieldTypeDecorator },
    } = specifier;
    let specifierName = name(specifier.imported);

    if ((VALID_FIELD_DECORATORS as any)[specifierName]) {
      validateUsageAndGetFieldMeta(path, fields, fieldTypeDecorator, specifierName as FieldType);
    }

    if (specifierName === 'adopts') {
      parent = validateUsageAndGetParentMeta(path, fieldTypeDecorator);
    }
  }

  metas.set(key, { fields, parent });
}

function validateUsageAndGetFieldMeta(
  path: NodePath<ImportDeclaration>,
  fields: FieldsMeta,
  fieldTypeDecorator: string,
  actualName: FieldType
) {
  for (let fieldIdentifier of path.scope.bindings[fieldTypeDecorator].referencePaths) {
    if (!isCallExpression(fieldIdentifier.parent) || fieldIdentifier.parent.callee !== fieldIdentifier.node) {
      throw error(fieldIdentifier, `the @${fieldTypeDecorator} decorator must be called`);
    }

    if (
      !isDecorator(fieldIdentifier.parentPath.parent) ||
      fieldIdentifier.parentPath.parent.expression !== fieldIdentifier.parent
    ) {
      throw error(fieldIdentifier, `the @${fieldTypeDecorator} decorator must be used as a decorator`);
    }

    let fieldPath = fieldIdentifier.parentPath.parentPath.parentPath;
    if (!fieldPath.isClassProperty() && !fieldPath.isClassMethod()) {
      throw error(
        fieldIdentifier,
        `the @${fieldTypeDecorator} decorator can only go on class properties or class methods`
      );
    }

    if (fieldPath.node.computed) {
      throw error(fieldPath, 'field names must not be dynamically computed');
    }

    if (!isIdentifier(fieldPath.node.key) && !isStringLiteral(fieldPath.node.key)) {
      throw error(fieldIdentifier, 'field names must be identifiers or string literals');
    }

    if (fieldPath.isClassMethod()) {
      if (fieldPath.node.params.length !== 0) {
        throw error(fieldPath.get('params')[0], 'computed fields take no arguments');
      }
      if (fieldPath.node.static) {
        throw error(fieldPath, 'computed fields should not be static');
      }
    }

    let fieldName = name(fieldPath.node.key);
    fields[fieldName] = {
      ...extractDecoratorArguments(fieldIdentifier.parentPath as NodePath<CallExpression>, fieldTypeDecorator),
      type: actualName,
    };
  }
}

function validateUsageAndGetParentMeta(path: NodePath<ImportDeclaration>, fieldTypeDecorator: string): ParentMeta {
  let adoptsIdentifier = path.scope.bindings[fieldTypeDecorator].referencePaths[0];

  if (!isClassDeclaration(adoptsIdentifier.parentPath.parentPath.parent)) {
    throw error(adoptsIdentifier, '@adopts decorator can only be used on a class');
  }

  return extractDecoratorArguments(adoptsIdentifier.parentPath as NodePath<CallExpression>, fieldTypeDecorator);
}

function extractDecoratorArguments(callExpression: NodePath<CallExpression>, fieldTypeDecorator: string) {
  if (callExpression.node.arguments.length !== 1) {
    throw error(callExpression, `@${fieldTypeDecorator} decorator accepts exactly one argument`);
  }

  let cardTypePath = callExpression.get('arguments')[0];
  let cardType = cardTypePath.node;
  if (!isIdentifier(cardType)) {
    throw error(cardTypePath, `@${fieldTypeDecorator} argument must be an identifier`);
  }

  let definition = cardTypePath.scope.getBinding(cardType.name)?.path;
  if (!definition) {
    throw error(cardTypePath, `@${fieldTypeDecorator} argument is not defined`);
  }
  if (!definition.isImportDefaultSpecifier()) {
    throw error(definition, `@${fieldTypeDecorator} argument must come from a module default export`);
  }

  return {
    cardURL: (definition.parent as ImportDeclaration).source.value,
    typeDecoratorLocalName: definition.node.local.name,
  };
}

// We fix these up all nicely, but annoyingly babel will rewrite them...
function asClassName(name: string) {
  if (name.toLowerCase().endsWith('class')) {
    name = name.slice(0, -5);
  }
  return upperFirst(camelCase(`${name} class`));
}
