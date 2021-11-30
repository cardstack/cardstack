/* eslint-disable @typescript-eslint/naming-convention */
import * as syntax from '@glimmer/syntax';
import type {
  PathExpression,
  ElementNode,
  BlockStatement,
  Statement,
  Node,
} from '@glimmer/syntax/dist/types/lib/v1/api';
import { CompiledCard, Field, Format } from './interfaces';
import { singularize } from 'inflection';
import { cloneDeep } from 'lodash';
import { classify } from './utils';
import { augmentBadRequest } from './utils/errors';
import { getFieldForPath } from './utils/fields';

const MODEL = '@model';
const FIELDS = '@fields';

const IN_PROCESS_ELEMENT_ESCAPE = '__';
class InvalidFieldsUsageError extends Error {
  message = 'Invalid use of @fields API';
}

type ImportAndChooseName = (desiredName: string, moduleSpecifier: string, importedName: string) => string;

export interface TemplateUsageMeta {
  model: 'self' | Set<string>;
  fields: Map<string, Format>;
}

export interface Options {
  fields: CompiledCard['fields'];
  usageMeta: TemplateUsageMeta;
  defaultFieldFormat: Format;
  moduleName?: string;
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
    }
  | {
      type: 'pathExpression';
      value: string;
    };

type ScopeValue =
  | PrimitiveScopeValue
  // A virtualScope allows us to claim a name in *part* of a real glimmer
  // template scope. For any given name, if it's used as a child of one of the
  // nodes in the nodes map, it takes the value of the corresponding value in
  // the nodes map.
  //
  // If it doesn't appear in the nodes map, this scope doesn't have any opinion
  // on that name, and the search should continue in the parent scope.
  | {
      type: 'virtualScope';
      nodes: Map<syntax.ASTv1.Statement, PrimitiveScopeValue>;
    };

type Scope = Map<string, ScopeValue>;

interface State {
  scopes: Scope[];
  nextScope: Scope | undefined;
  handledFieldExpressions: WeakSet<PathExpression>;
  handledModelExpressions: WeakSet<PathExpression>;
}

export default function glimmerCardTemplateTransform(source: string, options: Options) {
  try {
    return syntax.print(
      syntax.preprocess(source, {
        mode: 'codemod',
        plugins: {
          ast: [cardTransformPlugin(options)],
        },
        meta: {
          moduleName: options.moduleName,
        },
      })
    );
  } catch (error: any) {
    throw augmentBadRequest(error);
  }
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(env: syntax.ASTPluginEnvironment): syntax.ASTPlugin {
    let { fields, importAndChooseName, usageMeta, defaultFieldFormat } = options;
    let state: State = {
      scopes: [new Map()],
      nextScope: undefined,
      handledFieldExpressions: new WeakSet(),
      handledModelExpressions: new WeakSet(),
    };

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          if (node.tag === FIELDS) {
            throw new InvalidFieldsUsageError();
          }

          let fieldFormat = getFieldFormat(node, defaultFieldFormat);
          let fieldFullPath = fieldPathForElementNode(node);

          if (fieldFullPath) {
            let field = getFieldForPath(fields, fieldFullPath);
            if (!field) {
              throw new Error(`unknown field ${fieldFullPath}`);
            }
            if (field.type === 'containsMany') {
              return expandContainsManyShorthand(`${FIELDS}.${fieldFullPath}`);
            }
            usageMeta.fields.set(fieldFullPath, fieldFormat);
            return rewriteElementNode({
              field,
              importAndChooseName,
              modelArgument: `${MODEL}.${fieldFullPath}`,
              format: fieldFormat,
              state,
            });
          }

          let { tag } = node;
          if (tag.startsWith(IN_PROCESS_ELEMENT_ESCAPE)) {
            tag = tag.replace(IN_PROCESS_ELEMENT_ESCAPE, '');
          } else if (!/[A-Z]/.test(tag[0])) {
            // not a possible invocation of a local variable
            return;
          }

          let val = lookupScopeVal(tag, path, state);
          switch (val.type) {
            case 'normal':
              return;
            case 'stringLiteral':
              throw new Error(`tried to replace a component invocation with a string literal`);
            case 'pathExpression':
              throw new Error(`tried to replace a component invocation with a path expression`);
            case 'fieldComponent':
              if (val.expandable && val.field.type === 'containsMany') {
                return expandContainsManyShorthand(`${FIELDS}.${val.fieldFullPath}`);
              }
              usageMeta.fields.set(val.fieldFullPath, fieldFormat);
              return rewriteElementNode({
                field: val.field,
                importAndChooseName,
                modelArgument: val.pathForModel,
                format: fieldFormat,
                state,
              });
            default:
              throw assertNever(val);
          }
        },

        PathExpression(node, path) {
          if (state.handledFieldExpressions.has(node)) {
            let pathTail = node.original.slice(`${FIELDS}.`.length);

            let newExpression = env.syntax.builders.path(`${MODEL}.${pathTail}`);
            state.handledModelExpressions.add(newExpression);
            return newExpression;
          }

          let val = lookupScopeVal(node.original, path, state);
          switch (val.type) {
            case 'normal':
              if (isFieldPathExpression(node)) {
                throw new InvalidFieldsUsageError();
              }
              trackUsageForModel(usageMeta, node, state.handledModelExpressions);

              return;
            case 'stringLiteral':
              return env.syntax.builders.string(val.value);
            case 'pathExpression':
              return env.syntax.builders.path(val.value);
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

        BlockStatement: {
          enter(node) {
            let handled: { replacement?: unknown } | undefined = handleFieldsIterator(node, fields, state);

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
          exit() {},
        },
      },
    };
  };
}

function lookupScopeVal(identifier: string, path: syntax.WalkerPath<Node>, state: State): PrimitiveScopeValue {
  let [key, ...tail] = identifier.split('.');
  for (let scope of state.scopes) {
    let scopeVal = scope.get(key);
    if (!scopeVal) {
      continue;
    }

    if (tail.length && scopeVal.type === 'fieldComponent') {
      // todo: we should have a complete switch statement here for all
      // scopeVal.type cases
      let field = getFieldForPath(scopeVal.field.card.fields, tail.join('.'));
      if (field) {
        return {
          type: 'fieldComponent',
          field,
          pathForModel: identifier,
          fieldFullPath: scopeVal.fieldFullPath + '.' + tail.join('.'),
          expandable: true,
        };
      }
    }
    if (scopeVal.type === 'virtualScope') {
      let matched = enclosingScopeValue(path, scopeVal.nodes);
      if (matched) {
        return matched;
      }
    } else {
      return scopeVal;
    }
  }

  return { type: 'normal' };
}

function enclosingScopeValue(
  path: syntax.WalkerPath<Node>,
  nodes: Map<unknown, PrimitiveScopeValue>
): PrimitiveScopeValue | undefined {
  let cursor: syntax.WalkerPath<Node> | null = path;
  while (cursor) {
    let entry = nodes.get(cursor.node);
    if (entry) {
      return entry;
    }
    cursor = cursor.parent;
  }
  return undefined;
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
    type: 'virtualScope',
    nodes: new Map(),
  };
  let componentVar: ScopeValue = {
    type: 'virtualScope',
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

  let scope = state.scopes[0];

  if (node.program.blockParams[0]) {
    scope.set(node.program.blockParams[0], nameVar);
  }

  if (node.program.blockParams[1]) {
    scope.set(node.program.blockParams[1], componentVar);
  }

  return { replacement };
}

function handlePluralFieldIterator(node: BlockStatement, fields: CompiledCard['fields'], state: State) {
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

function rewriteElementNode(options: {
  field: Field;
  modelArgument: string;
  importAndChooseName: Options['importAndChooseName'];
  state: State;
  format: Format;
}): Statement[] {
  let { field, modelArgument, state, format } = options;

  let { inlineHBS } = field.card[format];

  if (inlineHBS) {
    return inlineTemplateForField(inlineHBS, modelArgument, state);
  } else {
    return rewriteFieldToComponent(options.importAndChooseName, field, modelArgument, state, format);
  }
}

function expandContainsManyShorthand(fieldName: string): Statement[] {
  let { element, blockItself, block, path } = syntax.builders;
  let segments = fieldName.split('.');
  let singularFieldName = singularize(segments[segments.length - 1]);
  let componentElement = element(IN_PROCESS_ELEMENT_ESCAPE + singularFieldName, {});
  componentElement.selfClosing = true;

  return [block(path('each'), [path(fieldName)], null, blockItself([componentElement], [singularFieldName]))];
}

// <@fields.createdAt /> -> <DateField @model={{@model.createdAt}} @set={{@set.setters.createdAt}} />
function rewriteFieldToComponent(
  importAndChooseName: ImportAndChooseName,
  field: Field,
  modelArgument: string,
  state: State,
  format: Format
): Statement[] {
  let { element, attr, mustache, path, text } = syntax.builders;

  let componentName = importAndChooseName(classify(field.card.url), field.card[format].moduleName, 'default');

  let modelExpression = path(modelArgument);
  state.handledModelExpressions.add(modelExpression);
  let attrs = [attr('@model', mustache(modelExpression)), attr('data-test-field-name', text(field.name))];

  if (format === 'edit') {
    let setterArg = modelArgument.replace(MODEL + '.', '');
    attrs.push(attr('@set', mustache(path(`@set.setters.${setterArg}`))));
  }

  let elementNode = element(componentName, { attrs });
  elementNode.selfClosing = true;
  return [elementNode];
}

function isFieldsIterator(node: BlockStatement): boolean {
  return (
    node.path.type === 'PathExpression' &&
    node.path.original === 'each-in' &&
    node.params[0]?.type === 'PathExpression' &&
    node.params[0].original === '@fields'
  );
}

function isFieldPathExpression(exp: PathExpression): boolean {
  return exp.original.startsWith(FIELDS);
}

function fieldPathForPathExpression(exp: PathExpression): string | undefined {
  if (isFieldPathExpression(exp)) {
    return exp.tail.join('.');
  }
  return undefined;
}

function trackUsageForModel(
  usageMeta: TemplateUsageMeta,
  node: syntax.ASTv1.PathExpression,
  handledModelExpressions: State['handledModelExpressions']
) {
  if (
    node.original === 'debugger' ||
    node.head.type !== 'AtHead' ||
    node.head.name !== MODEL ||
    handledModelExpressions.has(node)
  ) {
    return;
  }

  let path = node.tail.join('.');
  if (!path) {
    usageMeta.model = 'self';
  } else {
    if (usageMeta.model !== 'self') {
      usageMeta.model.add(path);
    }
  }
}

function fieldPathForElementNode(node: ElementNode): string | undefined {
  if (node.tag.startsWith(`${FIELDS}.`)) {
    return node.tag.slice(`${FIELDS}.`.length);
  }
  return undefined;
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}

function inlineTemplateForField(inlineHBS: string, fieldName: string, state: State): syntax.ASTv1.Statement[] {
  let { body } = syntax.preprocess(inlineHBS, {});
  let nodes: Map<syntax.ASTv1.Statement, PrimitiveScopeValue> = new Map();
  for (let statement of body) {
    nodes.set(statement, {
      type: 'pathExpression',
      value: fieldName,
    });
  }
  state.scopes[0].set('@model', {
    type: 'virtualScope',
    nodes,
  });
  return body;
}

function getFieldFormat(_node: ElementNode, defaultFieldFormat: Format): Format {
  // TODO: look at @format parameter on node to override default
  return defaultFieldFormat;
}
