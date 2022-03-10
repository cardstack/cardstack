/* eslint-disable @typescript-eslint/naming-convention */
import * as syntax from '@glimmer/syntax';
import type { PathExpression, ElementNode, BlockStatement, Node } from '@glimmer/syntax/dist/types/lib/v1/api';
import { Format } from './interfaces';
import { augmentBadRequest } from './utils/errors';
import { TemplateUsageMeta } from './babel-plugin-card-file-analyze';

const MODEL = '@model';
const FIELDS = '@fields';

const IN_PROCESS_ELEMENT_ESCAPE = '__';
class InvalidFieldsUsageError extends Error {
  message = 'Invalid use of @fields API';
}

export interface Options {
  usageMeta: TemplateUsageMeta;
  debugPath?: string;
}

type PrimitiveScopeValue =
  | { type: 'normal' }
  | {
      type: 'fieldComponent';
      pathForModel: string;
      fieldFullPath: string;
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
          moduleName: options.debugPath,
        },
      })
    );
  } catch (error: any) {
    throw augmentBadRequest(error);
  }
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(_env: syntax.ASTPluginEnvironment): syntax.ASTPlugin {
    let { usageMeta } = options;
    let state: State = {
      scopes: [new Map()],
      nextScope: undefined,
    };

    function trackFieldUsage(path: string, format: Format | 'default') {
      if (path === '') {
        usageMeta.fields = 'self';
      }
      if (usageMeta.fields !== 'self') {
        usageMeta.fields.set(path, format);
      }
    }

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          if (node.tag === FIELDS) {
            throw new InvalidFieldsUsageError();
          }

          let fieldFormat = getFieldFormat(node);
          let fieldFullPath = fieldPathForElementNode(node);

          if (fieldFullPath) {
            trackFieldUsage(fieldFullPath, fieldFormat);
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
              trackFieldUsage(val.fieldFullPath, fieldFormat);
              return;
            default:
              throw assertNever(val);
          }
        },

        PathExpression(node, path) {
          let val = lookupScopeVal(node.original, path, state);
          switch (val.type) {
            case 'normal':
              if (isFieldPathExpression(node)) {
                return;
              }
              trackUsageForModel(usageMeta, node);

              return;
            case 'stringLiteral':
            case 'pathExpression':
            case 'fieldComponent':
            default:
              return;
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
            state.nextScope = new Map();
            if (isFieldsIterator(node)) {
              if (node.program.blockParams[0]) {
                state.nextScope.set(node.program.blockParams[0], {
                  type: 'virtualScope',
                  nodes: new Map([
                    [
                      node,
                      {
                        type: 'stringLiteral',
                        value: 'PLACEHOLDER',
                      },
                    ],
                  ]),
                });
              }

              if (node.program.blockParams[1]) {
                state.nextScope.set(node.program.blockParams[1], {
                  type: 'virtualScope',
                  nodes: new Map([
                    [
                      node,
                      {
                        type: 'fieldComponent',
                        pathForModel: `@model`,
                        fieldFullPath: '',
                      },
                    ],
                  ]),
                });
              }
              return;
            }

            if (
              node.path.type === 'PathExpression' &&
              node.path.original === 'each' &&
              node.params[0]?.type === 'PathExpression'
            ) {
              let fieldFullPath = fieldPathForPathExpression(node.params[0]);
              if (fieldFullPath) {
                if (node.program.blockParams[0]) {
                  state.nextScope.set(node.program.blockParams[0], {
                    type: 'fieldComponent',
                    pathForModel: node.program.blockParams[0],
                    fieldFullPath,
                  });
                }

                if (node.program.blockParams[1]) {
                  state.nextScope.set(node.program.blockParams[1], {
                    type: 'normal',
                  });
                }
                return;
              }
            }

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
      return {
        type: 'fieldComponent',
        pathForModel: identifier,
        fieldFullPath: scopeVal.fieldFullPath + '.' + tail.join('.'),
      };
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

function trackUsageForModel(usageMeta: TemplateUsageMeta, node: syntax.ASTv1.PathExpression) {
  if (node.original === 'debugger' || node.head.type !== 'AtHead' || node.head.name !== MODEL) {
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

function getFieldFormat(_node: ElementNode): Format | 'default' {
  // TODO: look at @format parameter on node to override default
  return 'default';
}
