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

type PrimitiveScopeValue =
  | { type: 'normal' }
  | {
      type: 'fieldComponent';
      field: Field;
      pathForModel: string;
      fieldFullPath: string;
      expandable: boolean;
    }
  | {
      type: 'stringLiteral';
      value: string;
    };

type ScopeValue =
  | PrimitiveScopeValue
  | {
      type: 'listExpansion';
      nodes: Map<unknown, PrimitiveScopeValue>;
    };

type Scope = Map<string, ScopeValue>;

interface State {
  scopes: Scope[];
  nextScope: Scope | undefined;
  handledFieldExpressions: WeakSet<PathExpression>;
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
      scopes: [],
      nextScope: undefined,
      handledFieldExpressions: new WeakSet(),
    };

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          if (node.tag === FIELDS) {
            throw new InvalidFieldsUsageError();
          }

          let fieldFullPath = fieldPathForElementNode(node);
          if (fieldFullPath) {
            let field = getFieldForPath(fields, fieldFullPath);
            if (!field) {
              throw new Error(`unknown field ${fieldFullPath}`);
            }
            usedFields.push(fieldFullPath);
            return rewriteElementNode({
              field,
              importAndChooseName,
              modelArgument: fieldFullPath,
              prefix: MODEL_PREFIX,
            });
          }

          if (!/[A-Z]/.test(node.tag[0])) {
            // not a possible invocation of a local variable
            return;
          }

          let val = lookupScopeVal(node.tag, path, state);
          switch (val.type) {
            case 'normal':
              return;
            case 'stringLiteral':
              throw new Error(`tried to use a field name as a component`);
            case 'fieldComponent':
              return rewriteElementNode({
                field: val.field,
                importAndChooseName,
                modelArgument: val.pathForModel,
                forceSingular: !val.expandable,
              });
            default:
              throw assertNever(val);
          }
        },

        PathExpression(node, path) {
          if (state.handledFieldExpressions.has(node)) {
            return env.syntax.builders.path(
              `${MODEL_PREFIX}${node.original.slice(FIELDS_PREFIX.length)}`
            );
          }

          let val = lookupScopeVal(node.original, path, state);
          switch (val.type) {
            case 'normal':
              return;
            case 'stringLiteral':
              return env.syntax.builders.string(val.value);
            case 'fieldComponent':
              return;
            //throw new Error(`cannot use field component as a value`);
            default:
              throw assertNever(val);
          }
        },

        Block: {
          enter() {
            if (!state.nextScope) {
              throw new Error(`bug: all blocks should introduce a scope`);
            }
            state.scopes.unshift(state.nextScope);
            state.nextScope = undefined;
          },
          exit() {
            state.scopes.shift();
          },
        },

        BlockStatement(node) {
          let handled:
            | { replacement?: unknown }
            | undefined = handleFieldsIterator(node, fields, state);

          if (handled) {
            return handled.replacement;
          }

          handled = handlePluralFieldIterator(node, fields, state);
          if (handled) {
            return handled.replacement;
          }

          state.nextScope = new Map();
          for (let name of node.program.blockParams) {
            state.nextScope.set(name, { type: 'normal' });
          }

          return undefined;
        },
      },
    };
  };
}

function lookupScopeVal(
  identifier: string,
  path: syntax.WalkerPath<Node>,
  state: State
): PrimitiveScopeValue {
  let scopeVal = state.scopes.map((s) => s.get(identifier)).find(Boolean);

  if (!scopeVal) {
    return { type: 'normal' };
  }

  if (scopeVal.type === 'listExpansion') {
    return enclosingScopeValue(path, scopeVal.nodes);
  } else {
    return scopeVal;
  }
}

function enclosingScopeValue(
  path: syntax.WalkerPath<Node>,
  nodes: Map<unknown, PrimitiveScopeValue>
) {
  let cursor: syntax.WalkerPath<Node> | null = path;
  while (cursor) {
    let entry = nodes.get(cursor.node);
    if (entry) {
      return entry;
    }
    cursor = cursor.parent;
  }
  throw new Error(`bug: couldn't figure out which iteration we were in`);
}

function isFieldsIterator(node: BlockStatement): boolean {
  return (
    node.path.type === 'PathExpression' &&
    node.path.original === 'each-in' &&
    node.params[0]?.type === 'PathExpression' &&
    node.params[0].original === '@fields'
  );
}

function handleFieldsIterator(
  node: BlockStatement,
  fields: CompiledCard['fields'],
  state: State
): { replacement: syntax.ASTv1.Statement[] } | undefined {
  if (!isFieldsIterator(node)) {
    return;
  }

  let replacement: syntax.ASTv1.Statement[] = [];
  let nameVar: ScopeValue = {
    type: 'listExpansion',
    nodes: new Map(),
  };
  let componentVar: ScopeValue = {
    type: 'listExpansion',
    nodes: new Map(),
  };
  for (let [name, field] of Object.entries(fields)) {
    let copied = cloneDeep(node.program.body);
    for (let node of copied) {
      nameVar.nodes.set(node, {
        type: 'stringLiteral',
        value: name,
      });
      componentVar.nodes.set(node, {
        type: 'fieldComponent',
        field: field,
        pathForModel: `@model.${name}`,
        fieldFullPath: name,
        expandable: true,
      });
    }

    replacement = replacement.concat(copied);
  }

  let nextScope = new Map();

  if (node.program.blockParams[0]) {
    nextScope.set(node.program.blockParams[0], nameVar);
  }

  if (node.program.blockParams[1]) {
    nextScope.set(node.program.blockParams[1], componentVar);
  }

  state.nextScope = nextScope;

  return { replacement };
}

function handlePluralFieldIterator(
  node: BlockStatement,
  fields: CompiledCard['fields'],
  state: State
) {
  if (
    node.path.type !== 'PathExpression' ||
    node.path.original !== 'each' ||
    node.params[0]?.type !== 'PathExpression'
  ) {
    return;
  }

  let fieldFullPath = fieldPathForPathExpression(node.params[0]);
  if (!fieldFullPath) {
    return;
  }

  let field = getFieldForPath(fields, fieldFullPath);
  if (!field) {
    throw new Error(`unknown field ${fieldFullPath}`);
  }

  state.handledFieldExpressions.add(node.params[0]);
  state.nextScope = new Map();

  if (node.program.blockParams[0]) {
    state.nextScope.set(node.program.blockParams[0], {
      type: 'fieldComponent',
      field,
      pathForModel: node.program.blockParams[0],
      fieldFullPath,
      expandable: false,
    });
  }

  if (node.program.blockParams[1]) {
    state.nextScope.set(node.program.blockParams[1], {
      type: 'normal',
    });
  }

  return {};
}

function fieldPathForPathExpression(exp: PathExpression): string | undefined {
  if (exp.head.type === 'AtHead' && exp.head.name === '@fields') {
    return exp.tail.join('.');
  }
  return undefined;
}

function fieldPathForElementNode(node: ElementNode): string | undefined {
  if (node.tag.startsWith(FIELDS_PREFIX)) {
    return node.tag.slice(FIELDS_PREFIX.length);
  }
  return undefined;
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

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
