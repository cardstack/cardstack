import {
  ImportDeclaration,
  isImportSpecifier,
  isDecorator,
  isStringLiteral,
  isIdentifier,
  CallExpression,
  isCallExpression,
  isClassDeclaration,
} from '@babel/types';
import { NodePath } from '@babel/traverse';
import { name, error } from './utils/babel';

export const VALID_FIELD_DECORATORS = {
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

export default function main() {
  return {
    visitor: {
      ImportDeclaration(path: NodePath<ImportDeclaration>, state: State) {
        if (path.node.source.value === '@cardstack/types') {
          storeMeta(state.opts, path);
          path.remove();
        }
      },
    },
  };
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
