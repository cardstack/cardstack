import { transformSync, transformFromAstSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { CompiledCard, ComponentInfo, Format } from './interfaces';
import { getObjectKey, error } from './utils/babel';
import glimmerCardTemplateTransform from './glimmer-plugin-card-template';
import { getFieldForPath } from './utils/fields';
import { augmentBadRequest } from './utils/errors';
import { CallExpression } from '@babel/types';
import glimmerTemplateAnalyze from './glimmer-plugin-component-analyze';
import { isEmpty } from 'lodash';

interface TransformComponentOptions {
  templateSource: string;
  debugPath: string;
  fields: CompiledCard['fields'];
  defaultFieldFormat: Format;
  resolveImport: (relativePath: string) => string;
}

export default function (params: TransformComponentOptions): {
  source: string;
  ast: t.File;
  usedFields: ComponentInfo['usedFields'];
  inlineHBS: string | undefined;
} {
  // HACK: The / resets the relative path setup, removing the cwd of the hub.
  // This allows the error module to look a lot more like the card URL.
  let debugPath = '/' + params.debugPath.replace(/^\//, '');

  try {
    // this part will move into compiler's analyze phase, so it shouldn't use
    // any knowledge of CompiledCard, shouldn't resolve imports, etc.
    let { ast, meta } = analyzeComponent(params.templateSource, debugPath);

    // This will become the semantic phase
    let usedFields = buildUsedFieldsListFromUsageMeta(params.fields, params.defaultFieldFormat, meta);
    let inlineHBS = canInlineHBS(meta.hasModifiedScope, meta, params.fields, params.defaultFieldFormat)
      ? meta.rawHBS
      : undefined;

    return {
      // this part will move into the compiler's transform phase
      ...transformComponent({ ...params, debugPath }, ast, meta),
      usedFields,
      inlineHBS,
    };
  } catch (e: any) {
    throw augmentBadRequest(e);
  }
}

export interface ComponentMeta {
  model: 'self' | Set<string>;
  fields: 'self' | Map<string, Format | 'default'>;
  hasModifiedScope: boolean;
  rawHBS: string | undefined;
}

interface AnalyzePluginOptions {
  meta: ComponentMeta | undefined;
  debugPath: string;
}
interface AnalyzePluginState {
  opts: AnalyzePluginOptions;
  insideExportDefault: boolean;
}

export function analyzeComponent(templateSource: string, debugFilename: string): { ast: t.File; meta: ComponentMeta } {
  let options: AnalyzePluginOptions = { debugPath: debugFilename, meta: undefined };

  let out = transformSync(templateSource, {
    ast: true,
    code: false,
    plugins: [[babelPluginComponentAnalyze, options]],
    filename: debugFilename,
  });

  return { ast: out!.ast!, meta: options.meta! };
}

function babelPluginComponentAnalyze(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(_path: NodePath<t.Program>, state: AnalyzePluginState) {
          state.insideExportDefault = false;
        },
      },

      ExportDefaultDeclaration: {
        enter(_path: NodePath, state: AnalyzePluginState) {
          state.insideExportDefault = true;
        },
        exit(_path: NodePath, state: AnalyzePluginState) {
          state.insideExportDefault = false;
        },
      },

      CallExpression: {
        enter(path: NodePath<CallExpression>, state: AnalyzePluginState) {
          if (isComponentTemplateExpression(path, state)) {
            let { options: precompileTemplateOptions, template: rawTemplate } = validateAndGetComponent(path, t);
            let { fields, model } = glimmerTemplateAnalyze(rawTemplate, state.opts.debugPath);
            state.opts.meta = {
              rawHBS: rawTemplate,
              hasModifiedScope: !!getObjectKey(precompileTemplateOptions, 'scope', t),
              fields,
              model,
            };
          }
        },
      },
    },
  };
}

function transformComponent(transformOpts: TransformComponentOptions, ast: t.File, meta: ComponentMeta) {
  let pluginOptions: TransformPluginOptions = {
    transformOpts,
    meta,
  };

  let out = transformFromAstSync(ast, transformOpts.templateSource, {
    ast: true,
    plugins: [[babelPluginCardTemplate, pluginOptions]],
    filename: transformOpts.debugPath,
  })!;

  return { source: out!.code!, ast: out!.ast! };
}

interface TransformState {
  opts: TransformPluginOptions;
  insideExportDefault: boolean;
  importUtil: ImportUtil;
}

interface TransformPluginOptions {
  transformOpts: TransformComponentOptions;
  meta: ComponentMeta;
}

function babelPluginCardTemplate(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: TransformState) {
          state.importUtil = new ImportUtil(babel.types, path);
          state.insideExportDefault = false;
        },
      },

      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: TransformState) {
        let resolved = state.opts.transformOpts.resolveImport(path.node.source.value);
        if (resolved !== path.node.source.value) {
          path.node.source.value = resolved;
        }
      },

      ExportDefaultDeclaration: {
        enter(_path: NodePath, state: TransformState) {
          state.insideExportDefault = true;
        },
        exit(_path: NodePath, state: TransformState) {
          state.insideExportDefault = false;
        },
      },

      CallExpression: {
        enter(path: NodePath<CallExpression>, state: TransformState) {
          callExpressionEnter(path, state, t);
        },
      },
    },
  };
}

function callExpressionEnter(path: NodePath<t.CallExpression>, state: TransformState, t: typeof Babel.types) {
  if (!isComponentTemplateExpression(path, state)) {
    return;
  }

  let { options, template: inputTemplate } = validateAndGetComponent(path, t);

  let { template, neededScope } = transformTemplate(inputTemplate, path, state.opts.transformOpts, state.importUtil);
  path.node.arguments[0] = t.stringLiteral(template);

  updatePrecompileTemplateScopeOption(options, neededScope, t);
}

function isComponentTemplateExpression(
  path: NodePath<t.CallExpression>,
  state: TransformState | AnalyzePluginState
): boolean {
  return (
    state.insideExportDefault &&
    path.get('callee').referencesImport('@ember/template-compilation', 'precompileTemplate')
  );
}

function validateAndGetComponent(
  path: NodePath<t.CallExpression>,
  t: typeof Babel.types
): {
  options: NodePath<t.ObjectExpression>;
  template: string;
} {
  let args = path.get('arguments');
  if (args.length < 2) {
    throw error(path, 'precompileTemplate needs two arguments');
  }
  let template = args[0];
  let templateString: string;
  if (template.isStringLiteral()) {
    templateString = template.node.value;
  } else if (template.isTemplateLiteral()) {
    if (template.node.quasis.length > 1) {
      throw error(template, 'must not contain expressions');
    }
    let str = template.node.quasis[0].value.cooked;
    if (!str) {
      throw error(template, 'bug: no cooked value');
    }
    templateString = str;
  } else {
    throw error(template, 'must be a sting literal or template literal');
  }

  let options = args[1];
  if (!options.isObjectExpression()) {
    throw error(options, 'must be an object expression');
  }

  let strictMode = getObjectKey(options, 'strictMode', t);

  if (!strictMode?.isBooleanLiteral() || !strictMode.node.value) {
    throw error(options as NodePath<any>, 'Card Template precompileOptions requires strictMode to be true');
  }
  return { options, template: templateString };
}

function transformTemplate(
  source: string,
  path: NodePath<t.CallExpression>,
  opts: TransformComponentOptions,
  importUtil: ImportUtil
): { template: string; neededScope: Set<string> } {
  let neededScope = new Set<string>();

  function importAndChooseName(desiredName: string, moduleSpecifier: string, importedName: string): string {
    let { name } = importUtil.import(path, moduleSpecifier, importedName, `${desiredName}Field`);
    neededScope.add(name);
    return name;
  }

  let template = glimmerCardTemplateTransform(source, {
    fields: opts.fields,
    defaultFieldFormat: opts.defaultFieldFormat,
    debugPath: opts.debugPath,
    importAndChooseName,
  });

  return {
    template,
    neededScope,
  };
}

function updatePrecompileTemplateScopeOption(
  options: NodePath<t.ObjectExpression>,
  names: Set<string>,
  t: typeof Babel.types
): void {
  let scopeVars: t.ObjectExpression['properties'] = [];

  for (let name of names) {
    scopeVars.push(t.objectProperty(t.identifier(name), t.identifier(name), undefined, true));
  }

  let scope = getObjectKey(options, 'scope', t);

  if (!scope) {
    options.node.properties.push(
      t.objectProperty(t.identifier('scope'), t.arrowFunctionExpression([], t.objectExpression(scopeVars)))
    );
    return;
  }

  if (!scope.isArrowFunctionExpression() || scope.node.body.type !== 'ObjectExpression') {
    throw new Error('BUG: component scope is not a function and it should be');
  }

  scope.node.body.properties = scope.node.body.properties.concat(scopeVars);
}

function buildUsedFieldsListFromUsageMeta(
  fields: CompiledCard['fields'],
  defaultFieldFormat: Format,
  meta: ComponentMeta
): ComponentInfo['usedFields'] {
  let usedFields: Set<string> = new Set();

  if (meta.model && meta.model !== 'self') {
    for (const fieldPath of meta.model) {
      usedFields.add(fieldPath);
    }
  }

  if (meta.fields === 'self') {
    usedFields = new Set([...usedFields, ...Object.keys(fields)]);
  } else {
    for (const [fieldPath, fieldFormat] of meta.fields.entries()) {
      buildUsedFieldListFromComponents(
        usedFields,
        fieldPath,
        fields,
        fieldFormat === 'default' ? defaultFieldFormat : fieldFormat
      );
    }
  }

  return [...usedFields];
}

function buildUsedFieldListFromComponents(
  usedFields: Set<string>,
  fieldPath: string,
  fields: CompiledCard['fields'],
  format: Format,
  prefix?: string
): void {
  let field = getFieldForPath(fields, fieldPath);

  if (field && field.card.componentInfos[format].usedFields.length) {
    for (const nestedFieldPath of field.card.componentInfos[format].usedFields) {
      buildUsedFieldListFromComponents(usedFields, nestedFieldPath, field.card.fields, 'embedded', fieldPath);
    }
  } else {
    if (prefix) {
      usedFields.add(`${prefix}.${fieldPath}`);
    } else {
      usedFields.add(fieldPath);
    }
  }
}

function canInlineHBS(
  hasModifiedScope: boolean,
  meta: ComponentMeta,
  fields: CompiledCard['fields'],
  defaultFieldFormat: Format
): boolean {
  if (hasModifiedScope) {
    return false;
  }

  if (isEmpty(fields)) {
    return true;
  }

  let fieldsToInspect: [string, Format | 'default'][];
  if (meta.fields === 'self') {
    fieldsToInspect = Object.keys(fields).map((path) => [path, defaultFieldFormat]);
  } else {
    fieldsToInspect = [...meta.fields.entries()];
  }

  // If every field this card uses is inlinable, then this card can be inlined as well
  return fieldsToInspect.every(([path, format]) => {
    let field = getFieldForPath(fields, path);
    let actualFormat: Format = format === 'default' ? defaultFieldFormat : format;
    return !!field?.card.componentInfos[actualFormat].inlineHBS;
  });
}
