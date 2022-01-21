import {
  ImportDeclaration,
  identifier,
  callExpression,
  stringLiteral,
  isIdentifier,
  isCallExpression,
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
import { error } from './utils/babel';
import { FieldMeta, PluginMeta, VALID_FIELD_DECORATORS } from './babel-plugin-card-schema-analyze';
import { CompiledCard } from './interfaces';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';

const processedImports = new WeakSet<NodePath<ImportDeclaration>>();
interface State {
  opts: {
    fields: CompiledCard['fields'];
    meta: PluginMeta;
  };
}

export default function main() {
  return {
    visitor: {
      ImportDeclaration(path: NodePath<ImportDeclaration>, state: State) {
        // don't re-process the imports we replaced
        if (processedImports.has(path)) {
          return;
        }

        let type = cardTypeByURL(path.node.source.value, state);
        if (type === 'primitive') {
          path.remove();
        } else if (type === 'composite') {
          if (path.node.specifiers.length !== 1 || !isImportDefaultSpecifier(path.node.specifiers[0])) {
            throw error(path, `expecting a default import for card`);
          }
          let fieldMetas = fieldMetasForCardURL(path.node.source.value, state);
          if (fieldMetas.length === 0) {
            throw new Error(`should never get here`);
          }
          let [fieldName] = fieldMetas[0]; // all these fields share the same field card--so just use the first one
          let resolvedModule = state.opts.fields[fieldName].card.schemaModule.global;
          path.replaceWith(
            importDeclaration(
              [importDefaultSpecifier(identifier(asClassName(path.node.specifiers[0].local.name)))],
              stringLiteral(resolvedModule)
            )
          );
        }
        processedImports.add(path);
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
            handleClassMethod(bodyItem as NodePath<ClassMethod>, state);
          }
        }
      },
    },
  };
}

function handleClassMethod(path: NodePath<ClassMethod>, _state: State) {
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

    let type = cardTypeByFieldName(path.node.key.name, state);
    if (!type) {
      throw error(path.get('key'), `cannot find field in card`);
    }
    if (type === 'primitive') {
      transformPrimitiveField(path);
    } else {
      transformCompositeField(path, state);
    }
  }
}

// we consider a primitive card any card that has no fields
function cardTypeByURL(url: string, state: State): 'primitive' | 'composite' | undefined {
  let metas = fieldMetasForCardURL(url, state);
  if (metas.length === 0) {
    return;
  }

  // all these fields share the same field card--so just use the first one
  let [fieldName] = metas[0];
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
function transformCompositeField(path: NodePath<ClassProperty>, state: State) {
  if (!isIdentifier(path.node.key)) {
    return;
  }
  let fieldName = path.node.key.name;
  let fieldMeta = state.opts.meta.fields[fieldName];
  path.replaceWith(
    classMethod(
      'method',
      identifier(fieldName),
      [],
      blockStatement([
        returnStatement(
          newExpression(identifier(asClassName(fieldMeta.typeDecoratorLocalName)), [
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

function asClassName(name: string): string {
  if (name.toLowerCase().endsWith('class')) {
    name = name.slice(0, -5);
  }
  return upperFirst(camelCase(`${name}-class`));
}
