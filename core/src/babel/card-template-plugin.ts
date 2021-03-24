import * as syntax from '@glimmer/syntax';
import { NodePath } from '@babel/core';
import {
  CallExpression,
  ObjectExpression,
  ObjectProperty,
  isExportDefaultDeclaration,
  importDefaultSpecifier,
  ImportDeclaration,
  importDeclaration,
  stringLiteral,
  StringLiteral,
  objectProperty,
  objectExpression,
  identifier,
  assertProgram,
  BooleanLiteral,
} from '@babel/types';
import { CompiledCard, Field, TemplateModule } from '../interfaces';
import cardGlimmerPlugin from '../glimmer/card-template-plugin';

import { getObjectKey, name } from './utils';

const SCOPE = 'scope';
type TransformOptions = {
  fields: CompiledCard['fields'];
  templateModule: TemplateModule;
};
const PRECOMPILE_CALLEE = 'precompileTemplate';

export default function main() {
  return {
    visitor: {
      CallExpression(
        path: NodePath<CallExpression>,
        state: { opts: TransformOptions }
      ) {
        let { fields, templateModule } = state.opts;
        if (name(path.node.callee) === PRECOMPILE_CALLEE) {
          if (!isExportDefaultDeclaration(path.parentPath.parentPath.node)) {
            console.debug(
              'Skipping over component that is not part of the default export'
            );
            return;
          }
          let options = path.node.arguments[1] as ObjectExpression;
          assertStrictMode(options);

          let template = (path.node.arguments[0] as StringLiteral).value;

          let importNames = addImportsForFields(path, fields);

          template = transformTemplate(template, fields, importNames);
          path.node.arguments[0] = stringLiteral(template);

          let scope = buildScopeForOptions(options, importNames);
          if (scope) {
            options.properties.push(scope);
          }

          if (shouldInlineHBS(scope)) {
            templateModule.inlineHBS = template;
          }
        }
      },
    },
  };
}

function assertStrictMode(options: ObjectExpression) {
  let strictMode = getObjectKey(options, 'strictMode');
  if (!strictMode || (strictMode.value as BooleanLiteral).value === false) {
    throw new Error(
      'Card Template precompileOptions requires strictMode to be true'
    );
  }
}

function addImportsForFields(
  path: NodePath<CallExpression>,
  fields: CompiledCard['fields']
): Map<string, string> {
  let importNames: Map<string, string> = new Map();
  for (const key in fields) {
    const field = fields[key];

    // We can skip fields that are inlinable
    if (canInline(field)) {
      continue;
    }

    let importName = unusedNameForCard(field.card.url, path);
    importNames.set(key, importName);
    let fieldEmbeddedModuleName =
      field.card.templateModules.embedded.moduleName;

    let fieldImport = importDeclaration(
      [importDefaultSpecifier(identifier(importName))],
      stringLiteral(fieldEmbeddedModuleName)
    );

    appendImport(path, fieldImport);
  }
  return importNames;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Take a card URL and turn it into a unique import name
 * ie: http://cardstack.com/base/models/date -> DateField
 */
function unusedNameForCard(
  cardURL: string,
  path: NodePath<CallExpression>
): string {
  let name = cardURL.substring(cardURL.lastIndexOf('/') + 1);
  let properName = `${capitalize(name)}Field`;
  let candidate = properName;
  let counter = 0;
  while (path.scope.getBinding(candidate)) {
    candidate = `${name}${counter++}`;
  }
  return candidate;
}

function appendImport(
  path: NodePath<CallExpression>,
  fieldImport: ImportDeclaration
) {
  let program = path.parentPath.parentPath.parentPath.node;
  assertProgram(program);
  program.body.push(fieldImport);
}

function canInline(field: Field) {
  return !!field.card.templateModules.embedded.inlineHBS;
}

/**
 * We should inline the hbs of cards that have no additional scope,
 * ie component scope deps
 */
function shouldInlineHBS(scope: ObjectProperty): boolean {
  if (!scope) {
    return true;
  }

  return (scope.value as ObjectExpression).properties.length === 0;
}

function transformTemplate(
  source: string,
  fields: CompiledCard['fields'],
  importNames: Map<string, string>
): string {
  return syntax.print(
    syntax.preprocess(source, {
      mode: 'codemod',
      plugins: {
        ast: [cardGlimmerPlugin({ fields, importNames })],
      },
    })
  );
}

/**
 * TODO: This is kind of a nightmare.
 * Should I try and reuse the existing scope?
 * Why are the types so bad
 */
function buildScopeForOptions(
  options: ObjectExpression,
  usedNames: Map<string, string>
): ObjectProperty {
  let scopeVars: ObjectProperty[] = [];
  usedNames.forEach((name) =>
    scopeVars.push(
      objectProperty(identifier(name), identifier(name), undefined, true)
    )
  );

  let scope = getObjectKey(options, SCOPE);

  if (scope) {
    (scope.value as ObjectExpression).properties.forEach((p: ObjectProperty) =>
      scopeVars.push(p)
    );
  }

  return objectProperty(identifier(SCOPE), objectExpression(scopeVars));
}
