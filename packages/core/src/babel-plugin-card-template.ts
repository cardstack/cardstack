/* eslint-disable @typescript-eslint/naming-convention */
import { TemplateUsageMeta } from './glimmer-plugin-card-template';
// import ETC from 'ember-source/dist/ember-template-compiler';
// const { preprocess, print } = ETC._GlimmerSyntax;

import { transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';

import { CompiledCard, SerializerName, Format, SerializerMap } from './interfaces';

import { getObjectKey, error, ImportDetails, addImports } from './utils/babel';
import glimmerCardTemplateTransform from './glimmer-plugin-card-template';
import { buildSerializerMapFromUsedFields, buildUsedFieldsListFromUsageMeta } from './utils/fields';
import { augmentBadRequest } from './utils/errors';
import { CallExpression } from '@babel/types';
export interface CardComponentPluginOptions {
  debugPath: string;
  fields: CompiledCard['fields'];
  defaultFieldFormat: Format;
  // these are for gathering output
  usedFields: string[];
  inlineHBS: string | undefined;
  serializerMap: SerializerMap;
}

interface State {
  opts: CardComponentPluginOptions;
  insideExportDefault: boolean;
  importUtil: ImportUtil;

  // keys are local names in this module that we have chosen.
  neededImports: ImportDetails;
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
          state.neededImports = new Map();
        },
        exit(path: NodePath<t.Program>, state: State) {
          addImports(state.neededImports, path, t);
          addGetCardModelOptions(path, state, babel);
        },
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

function addGetCardModelOptions(path: NodePath<t.Program>, state: State, babel: typeof Babel) {
  let t = babel.types;
  // This will eventually replace addSerializerMap
  let serializerMap = buildSerializerMapFromUsedFields(state.opts.fields, state.opts.usedFields);
  state.opts.serializerMap = serializerMap;

  path.node.body.push(
    t.exportNamedDeclaration(
      t.functionDeclaration(
        t.identifier('getCardModelOptions'),
        [],
        t.blockStatement([
          babel.template(`
            return {
              serializerMap: %%serializerMap%%,
              computedFields: %%computedFields%%,
              usedFields: %%usedFields%%
            };
          `)({
            serializerMap: t.objectExpression(buildSerializerMapProp(serializerMap, t)),
            computedFields: t.arrayExpression(
              Object.values(state.opts.fields)
                .filter((field) => field.computed)
                .map((field) => t.stringLiteral(field.name))
            ),
            usedFields: t.arrayExpression(state.opts.usedFields.map((field) => t.stringLiteral(field))),
          }) as t.Statement,
        ])
      )
    )
  );
}

function buildSerializerMapProp(serializerMap: SerializerMap, t: typeof Babel.types): t.ObjectExpression['properties'] {
  let props: t.ObjectExpression['properties'] = [];

  for (let serializer in serializerMap) {
    let fieldList = serializerMap[serializer as SerializerName];
    if (!fieldList) {
      continue;
    }

    let fieldListElements: t.ArrayExpression['elements'] = [];
    for (let field of fieldList) {
      fieldListElements.push(t.stringLiteral(field));
    }
    props.push(t.objectProperty(t.identifier(serializer), t.arrayExpression(fieldListElements)));
  }

  return props;
}

function callExpressionEnter(path: NodePath<t.CallExpression>, state: State, t: typeof Babel.types) {
  if (shouldSkipExpression(path, state)) {
    return;
  }

  let { options, template: inputTemplate } = handleArguments(path, t);

  let { template, neededScope } = transformTemplate(inputTemplate, path, state.opts, state.neededImports);
  path.node.arguments[0] = t.stringLiteral(template);

  if (shouldInlineHBS(options, neededScope, t)) {
    state.opts.inlineHBS = template;
  }

  updateScope(options, neededScope, t);
}

function shouldSkipExpression(path: NodePath<t.CallExpression>, state: State): boolean {
  return (
    !state.insideExportDefault ||
    !path.get('callee').referencesImport('@ember/template-compilation', 'precompileTemplate')
  );
}

function shouldInlineHBS(options: NodePath<t.ObjectExpression>, neededScope: Set<string>, t: typeof Babel.types) {
  // TODO: this also needs to depend on whether they have a backing class other than templateOnlyComponent
  return !getObjectKey(options, 'scope', t) && neededScope.size == 0;
}

function handleArguments(
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
  opts: CardComponentPluginOptions,
  importNames: State['neededImports']
): { template: string; neededScope: Set<string> } {
  let neededScope = new Set<string>();

  function importAndChooseName(desiredName: string, moduleSpecifier: string, importedName: string): string {
    let name = findVariableName(`${desiredName}Field`, path, importNames);
    importNames.set(name, {
      moduleSpecifier,
      exportedName: importedName,
    });
    neededScope.add(name);
    return name;
  }

  let usageMeta: TemplateUsageMeta = { model: new Set(), fields: new Map() };

  let template = glimmerCardTemplateTransform(source, {
    fields: opts.fields,
    usageMeta,
    defaultFieldFormat: opts.defaultFieldFormat,
    debugPath: opts.debugPath,
    importAndChooseName,
  });

  opts.usedFields = buildUsedFieldsListFromUsageMeta(opts.fields, usageMeta);

  return { template, neededScope };
}

function findVariableName(
  desiredName: string,
  path: NodePath<t.CallExpression> | NodePath<t.Program>,
  importNames: State['neededImports']
) {
  let candidate = desiredName;
  let counter = 0;
  while (path.scope.getBinding(candidate) || importNames.has(candidate)) {
    candidate = `${desiredName}${counter++}`;
  }
  return candidate;
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
