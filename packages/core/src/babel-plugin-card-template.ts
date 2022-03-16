/* eslint-disable @typescript-eslint/naming-convention */
// import ETC from 'ember-source/dist/ember-template-compiler';
// const { preprocess, print } = ETC._GlimmerSyntax;

import { transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';

import { CompiledCard, ComponentInfo, Format } from './interfaces';

import { getObjectKey } from './utils/babel';
import glimmerCardTemplateTransform from './glimmer-plugin-card-template';
import { augmentBadRequest } from './utils/errors';
import { CallExpression } from '@babel/types';
import { getAndValidateTemplate, isComponentTemplateExpression } from './babel-plugin-card-file-analyze';

export interface CardComponentPluginOptions {
  debugPath: string;
  fields: CompiledCard['fields'];
  defaultFieldFormat: Format;
  resolveImport?: (relativePath: string) => string;
  // these are for gathering output
  usedFields: ComponentInfo['usedFields'];
  inlineHBS: string | undefined;
}

interface State {
  opts: CardComponentPluginOptions;
  insideExportDefault: boolean;
  importUtil: ImportUtil;
}

export default function (templateSource: string, options: CardComponentPluginOptions): { source: string; ast: t.File } {
  try {
    let out = transformSync(templateSource, {
      ast: true,
      plugins: [[babelPluginCardTemplate, options]],
      // HACK: The / resets the relative path setup, removing the cwd of the hub.
      // This allows the error module to look a lot more like the card URL.
      filename: '/' + options.debugPath.replace(/^\//, ''),
    });
    return { source: out!.code!, ast: out!.ast! };
  } catch (e: any) {
    throw augmentBadRequest(e);
  }
}

export function babelPluginCardTemplate(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          state.importUtil = new ImportUtil(babel.types, path);
          state.insideExportDefault = false;
        },
      },

      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        let { resolveImport } = state.opts;
        if (resolveImport) {
          path.node.source.value = resolveImport(path.node.source.value);
        }
      },

      ExportDefaultDeclaration: {
        enter(_path: NodePath, state: State) {
          state.insideExportDefault = true;
        },
        exit(_path: NodePath, state: State) {
          state.insideExportDefault = false;
        },
      },

      CallExpression: {
        enter(path: NodePath<CallExpression>, state: State) {
          callExpressionEnter(path, state, t);
        },
      },
    },
  };
}

function callExpressionEnter(path: NodePath<t.CallExpression>, state: State, t: typeof Babel.types) {
  if (!isComponentTemplateExpression(path, state)) {
    return;
  }

  let { precompileTemplateOptions, template: inputTemplate } = getAndValidateTemplate(path, t);
  let { template, neededScope } = transformTemplate(inputTemplate, path, state.opts, state.importUtil);
  path.node.arguments[0] = t.stringLiteral(template);

  updateScope(precompileTemplateOptions, neededScope, t);
}

function transformTemplate(
  source: string,
  path: NodePath<t.CallExpression>,
  opts: CardComponentPluginOptions,
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

  return { template, neededScope };
}

function updateScope(options: NodePath<t.ObjectExpression>, names: Set<string>, t: typeof Babel.types): void {
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
