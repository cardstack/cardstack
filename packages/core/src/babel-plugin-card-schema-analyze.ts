import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { BabelFileResult, transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { name, error } from './utils/babel';
import { augmentBadRequest } from './utils/errors';

// @ts-ignore
import decoratorsSyntaxPlugin from '@babel/plugin-syntax-decorators';
// @ts-ignore
import classPropertiesSyntaxPlugin from '@babel/plugin-syntax-class-properties';

export const VALID_FIELD_DECORATORS = {
  linksTo: true,
  contains: true,
  containsMany: true,
};
type Decorator = keyof typeof VALID_FIELD_DECORATORS | 'adopts';
const decoratorArgumentsLimits: Map<Decorator, { min: number; max: number }> = new Map([
  ['linksTo', { min: 1, max: 2 }],
  ['contains', { min: 1, max: 2 }],
  ['containsMany', { min: 1, max: 2 }],
  ['adopts', { min: 1, max: 1 }],
]);
type FieldType = keyof typeof VALID_FIELD_DECORATORS;
const VALID_FIELD_DECORATOR_OPTS_KEYS = ['computeVia'] as const;
type DecoratorOption = typeof VALID_FIELD_DECORATOR_OPTS_KEYS[number];

export interface FieldMeta {
  cardURL: string;
  type: FieldType;
  typeDecoratorLocalName: string;
  computed: boolean;
  computeVia?: string;
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

const metas = new WeakMap<State['opts'], PluginMeta>();

export default function (
  schemaSrc: string,
  options: any
): { code: BabelFileResult['code']; ast: BabelFileResult['ast'] } {
  let out: BabelFileResult;
  try {
    out = transformSync(schemaSrc, {
      ast: true,
      plugins: [
        [babelPluginCardSchemaAnalyze, options],
        [decoratorsSyntaxPlugin, { decoratorsBeforeExport: false }],
        classPropertiesSyntaxPlugin,
      ],
    })!;
  } catch (error: any) {
    throw augmentBadRequest(error);
  }

  return {
    code: out!.code,
    ast: out!.ast,
  };
}

export function babelPluginCardSchemaAnalyze(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        if (path.node.source.value === '@cardstack/types') {
          storeMeta(state.opts, path, t);
          path.remove();
        }
      },
    },
  };
}

function storeMeta(key: State['opts'], path: NodePath<t.ImportDeclaration>, t: typeof Babel.types) {
  let fields: FieldsMeta = {};
  let parent: ParentMeta | undefined;
  for (let specifier of path.node.specifiers) {
    // all our field-defining decorators are named exports
    if (!t.isImportSpecifier(specifier)) {
      return;
    }
    let {
      local: { name: fieldTypeDecorator },
    } = specifier;
    let specifierName = name(specifier.imported, t);

    if ((VALID_FIELD_DECORATORS as any)[specifierName]) {
      validateUsageAndGetFieldMeta(path, fields, fieldTypeDecorator as Decorator, specifierName as FieldType, t);
    }

    if (specifierName === 'adopts') {
      parent = validateUsageAndGetParentMeta(path, fieldTypeDecorator as Decorator, t);
    }
  }

  metas.set(key, { fields, parent });
}

function validateUsageAndGetFieldMeta(
  path: NodePath<t.ImportDeclaration>,
  fields: FieldsMeta,
  fieldTypeDecorator: Decorator,
  actualName: FieldType,
  t: typeof Babel.types
) {
  for (let fieldIdentifier of path.scope.bindings[fieldTypeDecorator].referencePaths) {
    if (!t.isCallExpression(fieldIdentifier.parent) || fieldIdentifier.parent.callee !== fieldIdentifier.node) {
      throw error(fieldIdentifier, `the @${fieldTypeDecorator} decorator must be called`);
    }

    if (
      !t.isDecorator(fieldIdentifier.parentPath.parent) ||
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

    if (!t.isIdentifier(fieldPath.node.key) && !t.isStringLiteral(fieldPath.node.key)) {
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

    let extractedDecoratorArguments = extractDecoratorArguments(
      fieldIdentifier.parentPath as NodePath<t.CallExpression>,
      fieldTypeDecorator,
      t
    );
    let synchronousComputed = fieldPath.isClassMethod() && !fieldPath.node.async;
    let { computed: asyncComputed } = extractedDecoratorArguments;

    let fieldName = name(fieldPath.node.key, t);
    fields[fieldName] = {
      ...extractedDecoratorArguments,
      type: actualName,
      computed: asyncComputed || synchronousComputed,
    };
  }
}

function validateUsageAndGetParentMeta(
  path: NodePath<t.ImportDeclaration>,
  fieldTypeDecorator: Decorator,
  t: typeof Babel.types
): ParentMeta {
  let adoptsIdentifier = path.scope.bindings[fieldTypeDecorator].referencePaths[0];

  if (!t.isClassDeclaration(adoptsIdentifier.parentPath.parentPath.parent)) {
    throw error(adoptsIdentifier, '@adopts decorator can only be used on a class');
  }

  return extractDecoratorArguments(adoptsIdentifier.parentPath as NodePath<t.CallExpression>, fieldTypeDecorator, t);
}

function extractDecoratorArguments(
  callExpression: NodePath<t.CallExpression>,
  decorator: Decorator,
  t: typeof Babel.types
) {
  let argumentLengths = decoratorArgumentsLimits.get(decorator);
  if (!argumentLengths) {
    throw error(callExpression, `@${decorator} is has no configured argument lengths`);
  }
  let { min, max } = argumentLengths;
  if (callExpression.node.arguments.length > max || callExpression.node.arguments.length < min) {
    throw error(
      callExpression,
      `@${decorator} decorator can only have ${
        min === max ? min + ' argument' : 'between ' + min + ' and ' + max + ' arguments'
      }`
    );
  }

  let decoratorArguments = callExpression.get('arguments');

  // First argument is always the card type
  let cardTypePath = decoratorArguments[0];
  let cardType = cardTypePath.node;
  if (!t.isIdentifier(cardType)) {
    throw error(cardTypePath, `@${decorator} argument must be an identifier`);
  }

  let definition = cardTypePath.scope.getBinding(cardType.name)?.path;
  if (!definition) {
    throw error(cardTypePath, `@${decorator} argument is not defined`);
  }
  if (!definition.isImportDefaultSpecifier()) {
    throw error(definition, `@${decorator} argument must come from a module default export`);
  }

  let result: Pick<FieldMeta, 'cardURL' | 'typeDecoratorLocalName'> & { computed?: boolean; computeVia?: string } = {
    cardURL: (definition.parent as t.ImportDeclaration).source.value,
    typeDecoratorLocalName: definition.node.local.name,
  };

  // second argument is the decorator options
  if (decoratorArguments.length === 2) {
    let maybeObjectExpression = decoratorArguments[1].node;
    if (!t.isObjectExpression(maybeObjectExpression)) {
      throw error(decoratorArguments[1], `@${decorator} second argument must be an object`);
    }
    let optionsProps = maybeObjectExpression.properties;
    for (let prop of optionsProps) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        (VALID_FIELD_DECORATOR_OPTS_KEYS as unknown as string[]).includes(prop.key.name) &&
        t.isStringLiteral(prop.value)
      ) {
        result.computed = true;
        result[prop.key.name as DecoratorOption] = prop.value.value;
      }
    }
  }

  if (decoratorArguments.length > 2) {
    throw error(callExpression, `@${decorator} have not implemented handling more than 2 arguments`);
  }

  return result;
}
