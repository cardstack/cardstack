import * as syntax from '@glimmer/syntax';
import type {
  PathExpression,
  ElementNode,
  BlockStatement,
  Statement,
  Node,
} from '@glimmer/syntax/dist/types/lib/v1/api';
import { CompiledCard, ComponentInfo, Field } from '../interfaces';
import { singularize } from 'inflection';
import { capitalize, cloneDeep } from 'lodash';
import { inlineTemplateForField } from './inline-field-plugin';
import { getFieldForPath } from '../utils';

class InvalidFieldsUsageError extends Error {
  message = 'Invalid use of @fields API';
}

const MODEL = '@model';
const MODEL_PREFIX = `${MODEL}.`;
const FIELDS = '@fields';
const FIELDS_PREFIX = `${FIELDS}.`;

type ImportAndChooseName = (
  desiredName: string,
  moduleSpecifier: string,
  importedName: string
) => string;

export interface Options {
  fields: CompiledCard['fields'];
  usedFields: ComponentInfo['usedFields'];
  importAndChooseName: ImportAndChooseName;
}

interface State {
  insidePluralFieldIterator:
    | {
        field: Field;
        fieldUsage: string;
        blockProgramUsage: string;
      }
    | undefined;
  insideFieldsIterator:
    | {
        nodes: Map<unknown, { name: string; field: Field }>;
        nameVar: string | undefined;
        componentVar: string | undefined;
      }
    | undefined;
}

export default function glimmerCardTemplateTransform(
  source: string,
  options: Options
) {
  return syntax.print(
    syntax.preprocess(source, {
      mode: 'codemod',
      plugins: {
        ast: [cardTransformPlugin(options)],
      },
    })
  );
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(
    env: syntax.ASTPluginEnvironment
  ): syntax.ASTPlugin {
    let { fields, importAndChooseName, usedFields } = options;
    let state: State = {
      insidePluralFieldIterator: undefined,
      insideFieldsIterator: undefined,
    };

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path): Statement[] | undefined {
          if (node.tag === FIELDS) {
            throw new InvalidFieldsUsageError();
          }

          if (
            state.insidePluralFieldIterator &&
            node.tag === state.insidePluralFieldIterator.blockProgramUsage
          ) {
            let {
              blockProgramUsage,
              field,
              fieldUsage,
            } = state.insidePluralFieldIterator;

            usedFields.push(fieldUsage);
            return rewriteElementNode({
              field,
              importAndChooseName,
              modelArgument: blockProgramUsage,
              forceSingular: true,
            });
          }

          let field: Field | undefined;
          let modelArgument: string | undefined;

          if (state.insideFieldsIterator) {
            if (node.tag === state.insideFieldsIterator.componentVar) {
              let { name } = enclosingField(path, state.insideFieldsIterator);
              field = fields[name];
              modelArgument = field.name;
            }
          }

          if (!field) {
            let fieldDetails = inferFieldDetailsFromElementNode(fields, node);
            if (fieldDetails) {
              field = fieldDetails.field;
              modelArgument = fieldDetails.path;
            }
          }

          if (!field || !modelArgument) {
            return;
          }

          usedFields.push(modelArgument);
          return rewriteElementNode({
            field,
            importAndChooseName,
            modelArgument,
            prefix: MODEL_PREFIX,
          });
        },

        PathExpression(node, path) {
          let orig = node.original;
          if (state.insideFieldsIterator) {
            if (orig === state.insideFieldsIterator.nameVar) {
              return env.syntax.builders.string(
                enclosingField(path, state.insideFieldsIterator).name
              );
            }
          }

          if (orig === FIELDS) {
            throw new InvalidFieldsUsageError();
          }

          if (
            state.insidePluralFieldIterator &&
            orig ===
              `${FIELDS_PREFIX}${state.insidePluralFieldIterator.fieldUsage}`
          ) {
            if (node.head.type === 'AtHead') {
              return env.syntax.builders.path(
                `${MODEL_PREFIX}${state.insidePluralFieldIterator.fieldUsage}`
              );
            }
          }

          return undefined;
        },

        BlockStatement: {
          enter(node) {
            if (isFieldsIterator(node)) {
              state.insideFieldsIterator = {
                nodes: new Map(),
                nameVar: node.program.blockParams[0],
                componentVar: node.program.blockParams[1],
              };

              let output: any[] = [];
              for (let [name, field] of Object.entries(fields)) {
                let copied = cloneDeep(node.program.body);
                for (let node of copied) {
                  state.insideFieldsIterator.nodes.set(node, {
                    name,
                    field,
                  });
                }

                output = output.concat(copied);
              }
              return output;
            }

            let fieldDetails = inferFieldDetailsFromNode(fields, node);

            if (!fieldDetails) {
              return;
            }

            state.insidePluralFieldIterator = {
              field: fieldDetails.field,
              fieldUsage: fieldDetails.path,
              blockProgramUsage: node.program.blockParams[0],
            };

            return undefined;
          },
          exit(/*node , path*/) {
            state.insidePluralFieldIterator = undefined;
          },
        },
      },
    };
  };
}

function isFieldsIterator(node: BlockStatement): boolean {
  let [firstArg] = node.params;

  let isIteratingOnFields =
    firstArg.type === 'PathExpression' && firstArg.original === '@fields';

  if (!isIteratingOnFields) {
    return false;
  }

  if (node.path.type === 'PathExpression' && node.path.original === 'each-in') {
    return true;
  }

  throw new InvalidFieldsUsageError();
}

function inferFieldDetailsFromElementNode(
  fields: CompiledCard['fields'],
  node: ElementNode | undefined
): { field: Field; path: string } | undefined {
  if (!node) {
    return;
  }

  if (node.tag.startsWith(FIELDS_PREFIX)) {
    let path = node.tag.slice(FIELDS_PREFIX.length);
    let field = getFieldForPath(fields, path);
    if (field) {
      return { field, path };
    }
  }

  return;
}

function inferFieldDetailsFromNode(
  fields: CompiledCard['fields'],
  node: PathExpression | ElementNode | BlockStatement | undefined
): { field: Field; path: string } | undefined {
  if (!node) {
    return;
  }

  if (node.type === 'ElementNode' && node.tag.startsWith(FIELDS_PREFIX)) {
    let path = node.tag.slice(FIELDS_PREFIX.length);
    let field = getFieldForPath(fields, path);
    if (field) {
      return { field, path };
    }
  }

  let exp: PathExpression | undefined;

  if (node.type === 'PathExpression') {
    exp = node;
  } else if (node.type === 'BlockStatement') {
    let [param] = node.params;
    // ie: {{#each @model.items as...
    if (param.type === 'PathExpression') {
      exp = param;
    }
    // ie: {{#each (helper @model.items) as...
    if (
      param.type === 'SubExpression' &&
      param.params[0].type === 'PathExpression'
    ) {
      exp = param.params[0];
    }
  }

  if (!exp) {
    return;
  }

  if (exp.head.type === 'AtHead' && exp.head.name === '@fields') {
    let path = exp.tail.join('.');
    let field = getFieldForPath(fields, path);
    if (field) {
      return { field, path };
    }
  }

  return;
}

function rewriteElementNode(options: {
  field: Field;
  modelArgument: string;
  importAndChooseName: Options['importAndChooseName'];
  forceSingular?: boolean;
  prefix?: string;
}): Statement[] {
  let { field, forceSingular, modelArgument, prefix } = options;
  let { inlineHBS } = field.card.embedded;

  if (!forceSingular && field.type === 'containsMany') {
    if (inlineHBS) {
      return process(expandContainsManyShorthand(modelArgument));
    } else {
      return process(
        expandContainsManyShorthand(
          modelArgument,
          rewriteFieldToComponent(
            options.importAndChooseName,
            field,
            modelArgument
          )
        )
      );
    }
  } else {
    if (inlineHBS) {
      return inlineTemplateForField(inlineHBS, modelArgument, prefix);
    } else {
      return process(
        rewriteFieldToComponent(
          options.importAndChooseName,
          field,
          modelArgument,
          prefix
        )
      );
    }
  }
}

function expandContainsManyShorthand(
  fieldName: string,
  itemTemplate?: string
): string {
  let eachParam = `${MODEL_PREFIX}${fieldName}`;
  let segments = fieldName.split('.');
  let singularFieldName = singularize(segments[segments.length - 1]);

  if (itemTemplate) {
    // TODO: This might be too aggressive...
    itemTemplate = itemTemplate.replace(fieldName, singularFieldName);
  } else {
    itemTemplate = `{{${singularFieldName}}}`;
  }

  return `{{#each ${eachParam} as |${singularFieldName}|}}${itemTemplate}{{/each}}`;
}

// <@model.createdAt /> -> <DateField @model={{@model.createdAt}} />
function rewriteFieldToComponent(
  importAndChooseName: ImportAndChooseName,
  field: Field,
  modelArgument: string,
  prefix?: string
): string {
  let componentName = importAndChooseName(
    capitalize(field.name),
    field.card.embedded.moduleName,
    'default'
  );

  if (prefix) {
    modelArgument = prefix + modelArgument;
  }

  return `<${componentName} @model={{${modelArgument}}} />`;
}

function process(template: string) {
  return syntax.preprocess(template).body;
}

function enclosingField(
  path: syntax.WalkerPath<Node>,
  inside: NonNullable<State['insideFieldsIterator']>
) {
  let cursor: syntax.WalkerPath<Node> | null = path;
  while (cursor) {
    let entry = inside.nodes.get(cursor.node);
    if (entry) {
      return entry;
    }
    cursor = cursor.parent;
  }
  throw new Error(`bug: couldn't figure out which iteration we were in`);
}
