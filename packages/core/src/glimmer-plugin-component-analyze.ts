import * as syntax from '@glimmer/syntax';
import { Format } from './interfaces';
import { augmentBadRequest } from './utils/errors';
import { ScopeTracker } from './glimmer-scope-tracker';
import { TemplateUsageMeta } from './babel-plugin-card-template';

class InvalidFieldsUsageError extends Error {
  message = 'Invalid use of @fields API';
}

type HandledFieldExpressions = WeakSet<syntax.ASTv1.PathExpression>;

export interface Options {
  usageMeta: TemplateUsageMeta;
  debugPath?: string;
}

type ScopeValue =
  | { type: 'field'; fieldPath: string }
  | { type: 'stringLiteral'; value: string }
  | { type: 'pathExpression'; value: string };

export default function glimmerTemplateAnalyze(source: string, options: Options) {
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
    let handledFieldExpressions: HandledFieldExpressions = new WeakSet();
    let scopeTracker = new ScopeTracker<ScopeValue>();

    function trackFieldUsage(path: string, format: Format | 'default' = 'default') {
      if (path === '') {
        usageMeta.fields = 'self';
      }
      if (usageMeta.fields !== 'self') {
        usageMeta.fields.set(path, format);
      }
    }

    function lookupScopeVal(
      fullPath: string,
      path: syntax.WalkerPath<syntax.ASTv1.Node>
    ): ReturnType<ScopeTracker<ScopeValue>['lookup']> {
      let [head, ...tail] = fullPath.split('.');
      let result = scopeTracker.lookup(head, path);
      if (result.type !== 'assigned' || result.value.type !== 'field' || tail.length === 0) {
        return result;
      }
      return {
        type: 'assigned',
        value: {
          type: 'field',
          fieldPath: result.value.fieldPath + '.' + tail.join('.'),
        },
      };
    }

    function trackScopeIfLoopingOverSpecificFieldPath(node: syntax.ASTv1.BlockStatement) {
      if (
        node.path.type === 'PathExpression' &&
        node.path.original === 'each' &&
        node.params[0]?.type === 'PathExpression' &&
        node.params[0].original.startsWith('@fields')
      ) {
        let fieldFullPath = fieldPathForPathExpression(node.params[0]);
        if (fieldFullPath) {
          scopeTracker.assign(
            node.program.blockParams[0],
            { type: 'field', fieldPath: fieldFullPath },
            { onNextScope: true }
          );
          handledFieldExpressions.add(node.params[0]);
        }
      }
    }

    function trackUsageIfEachInLoopOverFields(node: syntax.ASTv1.BlockStatement) {
      if (
        node.path.type === 'PathExpression' &&
        node.path.original === 'each-in' &&
        node.params[0]?.type === 'PathExpression' &&
        node.params[0].original === '@fields'
      ) {
        usageMeta.fields = 'self';
        handledFieldExpressions.add(node.params[0]);
      }
    }

    function trackUsageForModel(node: syntax.ASTv1.PathExpression) {
      if (node.original === 'debugger' || node.head.type !== 'AtHead' || node.head.name !== '@model') {
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

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          if (node.tag === '@fields') {
            throw new InvalidFieldsUsageError();
          }

          let fieldFullPath = fieldPathForElementNode(node);
          if (fieldFullPath) {
            return trackFieldUsage(fieldFullPath, 'default');
          }

          let result = lookupScopeVal(node.tag, path);
          if (result.type === 'assigned' && result.value.type === 'field') {
            trackFieldUsage(result.value.fieldPath);
          }
        },

        PathExpression(node, path) {
          if (handledFieldExpressions.has(node)) {
            return;
          }

          let result = scopeTracker.lookup(node.original, path);
          if (result.type === 'normal') {
            if (isFieldPathExpression(node)) {
              throw new InvalidFieldsUsageError();
            }
            return trackUsageForModel(node);
          }
        },

        Block: {
          enter() {
            scopeTracker.blockEnter();
          },
          exit() {
            scopeTracker.blockExit();
          },
        },

        BlockStatement: {
          enter(node) {
            scopeTracker.blockStatementEnter(node);
            trackUsageIfEachInLoopOverFields(node);
            trackScopeIfLoopingOverSpecificFieldPath(node);
          },
          exit() {},
        },
      },
    };
  };
}

function isFieldPathExpression(exp: syntax.ASTv1.PathExpression): boolean {
  return exp.original.startsWith('@fields');
}

function fieldPathForPathExpression(exp: syntax.ASTv1.PathExpression): string | undefined {
  if (isFieldPathExpression(exp)) {
    return exp.tail.join('.');
  }
  return undefined;
}

function fieldPathForElementNode(node: syntax.ASTv1.ElementNode): string | undefined {
  if (node.tag.startsWith(`@fields.`)) {
    return node.tag.slice(`@fields.`.length);
  }
  return undefined;
}
