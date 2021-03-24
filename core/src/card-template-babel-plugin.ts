import * as syntax from '@glimmer/syntax';
import { NodePath } from '@babel/core';
import {
  CallExpression,
  ObjectExpression,
  ObjectProperty,
  Expression,
  isExportDefaultDeclaration,
  importDefaultSpecifier,
  importDeclaration,
  isStringLiteral,
  isV8IntrinsicIdentifier,
  V8IntrinsicIdentifier,
  stringLiteral,
  StringLiteral,
  objectProperty,
  objectExpression,
  identifier,
  Identifier,
  isIdentifier,
} from '@babel/types';
import { CompiledCard, TemplateModule } from './interfaces';
import cardGlimmerPlugin from './card-template-glimmer-plugin';

const SCOPE = 'scope';
const FIELD_PREFIX = '@model.';
const FIELD_REGEX = new RegExp(`(?<=${FIELD_PREFIX})([A-Za-z]+)`, 'g');
type TransformOptions = {
  fields: CompiledCard['fields'];
  templateModule: TemplateModule;
};
const PRECOMPILE_CALLEE = 'precompileTemplate';

export default function main() {
  /*
    TODO: 
    1. Add imports for used fields
       - Make sure it's uniq
       - Don't duplicate imports
    2. Add used fields into precompileTemplate scope
    3. Figure out existing ember/glimmer babel plugins
    4. Run them
  */
  // TODO: Error if component found without strict: true
  return {
    visitor: {
      CallExpression(
        path: NodePath<CallExpression>,
        state: { opts: TransformOptions }
      ) {
        let { fields, templateModule } = state.opts;
        if (name(path.node.callee) === PRECOMPILE_CALLEE) {
          if (!isExportDefaultDeclaration(path.parentPath.parentPath.node)) {
            console.log(
              'Skipping over component that is not part of the default export'
            );
            return;
          }
          let importNames: Map<string, string> = new Map();
          let template = (path.node.arguments[0] as StringLiteral).value;
          let options = path.node.arguments[1] as ObjectExpression;

          let { fieldsToInline, fieldsToImport } = separateFields(
            fields,
            template
          );

          if (fieldsToImport) {
            for (const key in fieldsToImport) {
              const field = fieldsToImport[key];
              let importName = unusedNameForCard(field.card.url, path);
              importNames.set(key, importName);
              let fieldModuleName =
                field.card.templateModules.embedded.moduleName;

              let fieldImport = importDeclaration(
                [importDefaultSpecifier(identifier(importName))],
                stringLiteral(fieldModuleName)
              );

              // Errrr?
              path.parentPath.parentPath.parentPath.node.body.push(fieldImport);
            }
          }

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
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

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

function separateFields(
  fields: CompiledCard['fields'],
  template: string
): { [K in 'fieldsToInline' | 'fieldsToImport']: CompiledCard['fields'] } {
  let fieldsToInline: CompiledCard['fields'] = {};
  let fieldsToImport: CompiledCard['fields'] = {};

  let usedFields: Set<string> = new Set(template.match(FIELD_REGEX));

  for (const key in fields) {
    let field = fields[key];
    const inlineHBS = fields[key].card.templateModules.embedded.inlineHBS;

    if (inlineHBS) {
      fieldsToInline[key] = field;
    } else if (usedFields.has(key)) {
      fieldsToImport[key] = field;
    }
  }
  return { fieldsToInline, fieldsToImport };
}

/**
 * We should inline the hbs of cards that have no additional scope, ie component deps
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

  let scope = (options.properties.filter(
    (p: ObjectProperty) => name(p.key) === SCOPE
  ) as ObjectProperty[])[0];

  if (scope) {
    (scope.value as ObjectExpression).properties.forEach((p: ObjectProperty) =>
      scopeVars.push(p)
    );
  }

  return objectProperty(identifier(SCOPE), objectExpression(scopeVars));
}

function name(
  node: StringLiteral | Identifier | Expression | V8IntrinsicIdentifier
): string | undefined {
  if (isIdentifier(node) || isV8IntrinsicIdentifier(node)) {
    return node.name;
  } else if (isStringLiteral(node)) {
    return node.value;
  } else {
    return;
  }
}
