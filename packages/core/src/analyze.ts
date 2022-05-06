import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { BabelFileResult, transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { name, error, getObjectKey } from './utils/babel';
import { augmentBadRequest } from './utils/errors';

// @ts-ignore
import decoratorsSyntaxPlugin from '@babel/plugin-syntax-decorators';
// @ts-ignore
import classPropertiesSyntaxPlugin from '@babel/plugin-syntax-class-properties';
import { Format } from './interfaces';
import { validateAndGetComponent } from './babel-plugin-card-template';
import glimmerTemplateAnalyze from './glimmer-plugin-component-analyze';

interface State {
  opts: {
    debugPath: string;
  };
  insideDefaultExport: boolean;
  insideNamedExport: boolean;
}

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
export interface ExportMeta {
  name: 'default' | string;
  type: t.Declaration['type'];
}

export interface TemplateUsageMeta {
  model: 'self' | Set<string>;
  fields: 'self' | Map<string, Format | 'default'>;
}
export interface ComponentMeta {
  usage: TemplateUsageMeta;
  hasModifiedScope: boolean;
  rawHBS: string | undefined;
}
export interface FileMeta {
  exports?: ExportMeta[];
  fields: FieldsMeta;
  parent?: ParentMeta;
  component: Record<string, ComponentMeta> | undefined;
}

const metas = new WeakMap<State['opts'], FileMeta>();

function getMeta(obj: State['opts']): FileMeta {
  let meta = metas.get(obj);
  if (!meta) {
    return {
      fields: {},
      component: undefined,
    };
  }
  return meta;
}

export default function analyzeCardModule(
  source: string,
  debugPath: string
): {
  code: BabelFileResult['code'];
  ast: BabelFileResult['ast'];
  meta: FileMeta;
} {
  let out: BabelFileResult;
  let opts: State['opts'] = { debugPath };
  try {
    out = transformSync(source, {
      ast: true,
      plugins: [
        [babelPluginCardFileAnalyze, opts],
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
    meta: getMeta(opts),
  };
}

export function babelPluginCardFileAnalyze(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(_path: NodePath<t.Program>, state: State) {
          state.insideDefaultExport = false;
          state.insideNamedExport = false;
        },
      },
      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        if (path.node.source.value === '@cardstack/types') {
          storeDecoratorMeta(state.opts, path, t);
          path.remove();
        }
      },
      ExportNamedDeclaration: {
        enter(path: NodePath<t.ExportNamedDeclaration>, state: State) {
          state.insideNamedExport = true;
          switch (path.node.declaration?.type) {
            case 'FunctionDeclaration':
              storeExportMeta(state.opts, {
                name: name(path.node.declaration.id!, t),
                type: path.node.declaration.type,
              });
              break;
            case 'VariableDeclaration':
              for (const dec of path.node.declaration.declarations) {
                if (t.isIdentifier(dec.id)) {
                  storeExportMeta(state.opts, {
                    name: dec.id.name,
                    type: path.node.declaration.type,
                  });
                }
              }
              break;
          }
        },
        exit(_path: NodePath<t.ExportNamedDeclaration>, state: State) {
          state.insideDefaultExport = false;
          state.insideNamedExport = false;
        },
      },
      ExportDefaultDeclaration: {
        enter(path: NodePath<t.ExportDefaultDeclaration>, state: State) {
          state.insideDefaultExport = true;
          // Not sure what to do with expressions
          if (!t.isExpression(path.node.declaration)) {
            storeExportMeta(state.opts, {
              name: 'default',
              type: path.node.declaration.type,
            });
          }
        },
        exit(_path: NodePath<t.ExportDefaultDeclaration>, state: State) {
          state.insideDefaultExport = false;
        },
      },

      CallExpression: {
        enter(path: NodePath<t.CallExpression>, state: State) {
          if (isComponentTemplateExpression(path)) {
            if (state.insideDefaultExport) {
              storeComponentMeta(state, path, t, 'default');
            } else if (state.insideNamedExport) {
              let { node } = path.parentPath.parentPath;
              if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
                storeComponentMeta(state, path, t, node.id.name);
              }
            }
          }
        },
      },
    },
  };
}

function storeComponentMeta(
  state: State,
  path: NodePath<t.CallExpression>,
  t: typeof Babel.types,
  exportName = 'default'
) {
  let { options: precompileTemplateOptions, template: rawTemplate } = validateAndGetComponent(path, t);
  let usageMeta: TemplateUsageMeta = { model: new Set(), fields: new Map() };

  glimmerTemplateAnalyze(rawTemplate, {
    usageMeta,
    debugPath: state.opts.debugPath,
  });

  let meta = getMeta(state.opts);
  let componentMeta = {
    rawHBS: rawTemplate,
    hasModifiedScope: !!getObjectKey(precompileTemplateOptions, 'scope', t),
    usage: usageMeta,
  };

  if (!meta.component) {
    meta.component = {};
  }
  meta.component[exportName] = componentMeta;
  metas.set(state.opts, meta);
}

function storeExportMeta(key: State['opts'], exportMeta: ExportMeta) {
  let meta = getMeta(key);
  if (!meta.exports) {
    meta.exports = [];
  }

  meta.exports.push(exportMeta);
  metas.set(key, meta);
}

function storeDecoratorMeta(key: State['opts'], path: NodePath<t.ImportDeclaration>, t: typeof Babel.types) {
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

  let meta = getMeta(key);
  meta.fields = { ...meta.fields, ...fields };
  meta.parent = parent;
  metas.set(key, meta);
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
  if (!definition.isImportDefaultSpecifier() && !definition.isClassDeclaration()) {
    throw error(definition, `@${decorator} argument must come from a module default export or a class declaration`);
  }

  let result: Pick<FieldMeta, 'cardURL' | 'typeDecoratorLocalName'> & { computed?: boolean; computeVia?: string };
  if (definition.isImportDefaultSpecifier()) {
    result = {
      cardURL: (definition.parent as t.ImportDeclaration).source.value,
      typeDecoratorLocalName: definition.node.local.name,
    };
  } else {
    result = {
      cardURL: '.',
      typeDecoratorLocalName: definition.node.id.name,
    };
  }

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

function isComponentTemplateExpression(path: NodePath<t.CallExpression>): boolean {
  return path.get('callee').referencesImport('@ember/template-compilation', 'precompileTemplate');
}
