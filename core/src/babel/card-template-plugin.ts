import * as syntax from '@glimmer/syntax';
import { NodePath } from '@babel/core';
import {
  CallExpression,
  ObjectExpression,
  Program,
  importDefaultSpecifier,
  importSpecifier,
  importDeclaration,
  stringLiteral,
  objectProperty,
  objectExpression,
  identifier,
} from '@babel/types';
import { CompiledCard, TemplateModule } from '../interfaces';
import cardGlimmerPlugin from '../glimmer/card-template-plugin';

import { getObjectKey, error } from './utils';

export interface Options {
  fields: CompiledCard['fields'];
  templateModule: TemplateModule;
}

interface State {
  opts: Options;
  insideExportDefault: boolean;

  // keys are local names in this module that we have chosen.
  neededImports: Map<string, { moduleSpecifier: string; exportedName: string }>;
}

export default function main() {
  return {
    visitor: {
      Program: {
        enter(_path: NodePath, state: State) {
          state.insideExportDefault = false;
          state.neededImports = new Map();
        },
        exit: programExit,
      },

      ExportDefaultDeclaration: {
        enter(_path: NodePath, state: State) {
          state.insideExportDefault = true;
        },
        exit(_path: NodePath, state: State) {
          state.insideExportDefault = false;
        },
      },

      CallExpression: callExpressionEnter,
    },
  };
}

function programExit(path: NodePath<Program>, state: State) {
  for (let [
    localName,
    { moduleSpecifier, exportedName },
  ] of state.neededImports) {
    path.node.body.push(
      importDeclaration(
        [
          exportedName === 'default'
            ? importDefaultSpecifier(identifier(localName))
            : importSpecifier(identifier(localName), identifier(exportedName)),
        ],
        stringLiteral(moduleSpecifier)
      )
    );
  }
}

function callExpressionEnter(path: NodePath<CallExpression>, state: State) {
  if (shouldSkipExpression(path, state)) {
    return;
  }

  let { options, template: inputTemplate } = handleArguments(path);

  let { template, neededScope } = transformTemplate(
    inputTemplate,
    path,
    state.opts.fields,
    state.neededImports
  );
  path.node.arguments[0] = stringLiteral(template);

  if (shouldInlineHBS(options, neededScope)) {
    state.opts.templateModule.inlineHBS = template;
  }

  updateScope(options, neededScope);
}

function shouldSkipExpression(
  path: NodePath<CallExpression>,
  state: State
): boolean {
  return (
    !state.insideExportDefault ||
    !path
      .get('callee')
      .referencesImport('@ember/template-compilation', 'precompileTemplate')
  );
}

function shouldInlineHBS(
  options: NodePath<ObjectExpression>,
  neededScope: Set<string>
) {
  // TODO: this also needs to depend on whether they have a backing class other than templateOnlyComponent
  return !getObjectKey(options, 'scope') && neededScope.size == 0;
}

function handleArguments(
  path: NodePath<CallExpression>
): { options: NodePath<ObjectExpression>; template: string } {
  let args = path.get('arguments');
  if (args.length < 2) {
    throw error(path, 'precompileTemplate needs two arguments');
  }
  let template = args[0];
  if (!template.isStringLiteral()) {
    throw error(template, 'must be a string literal');
  }

  let options = args[1];
  if (!options.isObjectExpression()) {
    throw error(options, 'must be an object expression');
  }

  let strictMode = getObjectKey(options, 'strictMode');

  if (!strictMode?.isBooleanLiteral() || !strictMode.node.value) {
    throw error(
      options as NodePath<any>,
      'Card Template precompileOptions requires strictMode to be true'
    );
  }
  return { options, template: template.node.value };
}

function transformTemplate(
  source: string,
  path: NodePath<CallExpression>,
  fields: CompiledCard['fields'],
  importNames: State['neededImports']
): { template: string; neededScope: Set<string> } {
  let neededScope = new Set<string>();

  function importAndChooseName(
    desiredName: string,
    moduleSpecifier: string,
    importedName: string
  ): string {
    let candidate = `${desiredName}Field`;
    let counter = 0;
    while (path.scope.getBinding(candidate) || importNames.has(candidate)) {
      candidate = `${desiredName}${counter++}`;
    }
    importNames.set(candidate, { moduleSpecifier, exportedName: importedName });
    neededScope.add(candidate);
    return candidate;
  }

  let template = syntax.print(
    syntax.preprocess(source, {
      mode: 'codemod',
      plugins: {
        ast: [cardGlimmerPlugin({ fields, importAndChooseName })],
      },
    })
  );
  return { template, neededScope };
}

function updateScope(
  options: NodePath<ObjectExpression>,
  names: Set<string>
): void {
  let scopeVars: ObjectExpression['properties'] = [];

  for (let name of names) {
    scopeVars.push(
      objectProperty(identifier(name), identifier(name), undefined, true)
    );
  }

  let scope = getObjectKey(options, 'scope');

  if (scope?.isObjectExpression()) {
    scope.node.properties.concat(scopeVars);
  } else {
    options.node.properties.push(
      objectProperty(identifier('scope'), objectExpression(scopeVars))
    );
  }
}
