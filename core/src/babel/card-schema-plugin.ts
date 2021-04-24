import {
  ImportDeclaration,
  isImportSpecifier,
  variableDeclaration,
  variableDeclarator,
  identifier,
  objectPattern,
  objectProperty,
  callExpression,
  isDecorator,
  stringLiteral,
  isClassProperty,
  ImportSpecifier,
  isStringLiteral,
  isIdentifier,
  CallExpression,
  isCallExpression,
  isClassDeclaration,
} from '@babel/types';
import { NodePath } from '@babel/traverse';
import { name, error } from './utils';

const VALID_FIELD_DECORATORS = {
  hasMany: true,
  belongsTo: true,
  contains: true,
  containsMany: true,
};
type FieldType = keyof typeof VALID_FIELD_DECORATORS;

export type FieldMeta = {
  cardURL: string;
  type: FieldType;
  localName: string;
};
export type FieldsMeta = {
  [name: string]: FieldMeta;
};
export type ParentMeta = {
  cardURL: string;
};

export type PluginMeta = {
  fields: FieldsMeta;
  parent?: ParentMeta;
};

export function getMeta(obj: Object): PluginMeta {
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
  object,
  {
    parent?: ParentMeta;
    fields: FieldsMeta;
  }
>();

export default function main() {
  return {
    visitor: {
      ImportDeclaration(
        path: NodePath<ImportDeclaration>,
        state: { opts: object }
      ) {
        if (path.node.source.value === '@cardstack/types') {
          storeMeta(state.opts, path);
          let specifiers = path.node.specifiers.filter(
            (specifier) => specifier.type === 'ImportSpecifier'
          ) as ImportSpecifier[];

          path.replaceWith(
            variableDeclaration('const', [
              variableDeclarator(
                objectPattern(
                  specifiers.map((s) =>
                    objectProperty(s.imported, s.local, false, true)
                  )
                ),
                callExpression(identifier('require'), [
                  stringLiteral('@cardstack/core'),
                ])
              ),
            ])
          );
          return;
        }
      },
    },
  };
}

function storeMeta(key: object, path: NodePath<ImportDeclaration>) {
  let fields: FieldsMeta = {};
  let parent: ParentMeta | undefined;
  for (let specifier of path.node.specifiers) {
    // all our field-defining decorators are named exports
    if (!isImportSpecifier(specifier)) {
      return;
    }
    let {
      local: { name: localName },
    } = specifier;
    let specifierName = name(specifier.imported);

    if ((VALID_FIELD_DECORATORS as any)[specifierName]) {
      validateUsageAndGetFieldMeta(
        path,
        fields,
        localName,
        specifierName as FieldType
      );
    }

    if (specifierName === 'adopts') {
      parent = validateUsageAndGetParentMeta(path, localName);
    }
  }

  metas.set(key, { fields, parent });
}

function validateUsageAndGetFieldMeta(
  path: NodePath<ImportDeclaration>,
  fields: FieldsMeta,
  localName: string,
  actualName: FieldType
) {
  for (let fieldIdentifier of path.scope.bindings[localName].referencePaths) {
    if (
      !isCallExpression(fieldIdentifier.parent) ||
      fieldIdentifier.parent.callee !== fieldIdentifier.node
    ) {
      throw error(
        fieldIdentifier,
        `the @${localName} decorator must be called`
      );
    }

    if (
      !isDecorator(fieldIdentifier.parentPath.parent) ||
      fieldIdentifier.parentPath.parent.expression !== fieldIdentifier.parent
    ) {
      throw error(
        fieldIdentifier,
        `the @${localName} decorator must be used as a decorator`
      );
    }

    if (!isClassProperty(fieldIdentifier.parentPath.parentPath.parent)) {
      throw error(
        fieldIdentifier,
        `the @${localName} decorator can only go on class properties`
      );
    }

    if (fieldIdentifier.parentPath.parentPath.parent.computed) {
      throw error(
        fieldIdentifier,
        'field names must not be dynamically computed'
      );
    }

    if (
      !isIdentifier(fieldIdentifier.parentPath.parentPath.parent.key) &&
      !isStringLiteral(fieldIdentifier.parentPath.parentPath.parent.key)
    ) {
      throw error(
        fieldIdentifier,
        'field names must be identifiers or string literals'
      );
    }

    let fieldName = name(fieldIdentifier.parentPath.parentPath.parent.key);
    fields[fieldName] = {
      ...extractDecoratorArguments(
        fieldIdentifier.parentPath as NodePath<CallExpression>,
        localName
      ),
      type: actualName,
    };
  }
}

function validateUsageAndGetParentMeta(
  path: NodePath<ImportDeclaration>,
  localName: string
): ParentMeta {
  let adoptsIdentifer = path.scope.bindings[localName].referencePaths[0];

  if (!isClassDeclaration(adoptsIdentifer.parentPath.parentPath.parent)) {
    throw error(
      adoptsIdentifer,
      '@adopts decorator can only be used on a class'
    );
  }

  return extractDecoratorArguments(
    adoptsIdentifer.parentPath as NodePath<CallExpression>,
    localName
  );
}

function extractDecoratorArguments(
  callExpression: NodePath<CallExpression>,
  localName: string
) {
  if (callExpression.node.arguments.length !== 1) {
    throw error(
      callExpression,
      `@${localName} decorator accepts exactly one argument`
    );
  }

  let cardTypePath = callExpression.get('arguments')[0];
  let cardType = cardTypePath.node;
  if (!isIdentifier(cardType)) {
    throw error(cardTypePath, `@${localName} argument must be an identifier`);
  }

  let definition = cardTypePath.scope.getBinding(cardType.name)?.path;
  if (!definition) {
    throw error(cardTypePath, `@${localName} argument is not defined`);
  }
  if (!definition.isImportDefaultSpecifier()) {
    throw error(
      definition,
      `@${localName} argument must come from a module default export`
    );
  }

  return {
    cardURL: (definition.parent as ImportDeclaration).source.value,
    localName: definition.node.local.name,
  };
}
