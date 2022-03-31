import * as syntax from '@glimmer/syntax';
import { Format } from './interfaces';
import { augmentBadRequest } from './utils/errors';
import { ScopeTracker } from './glimmer-scope-tracker';
import { TemplateUsageMeta } from './analyze';

export class InvalidFieldsUsageError extends Error {
  message = 'Invalid use of @fields API';
}
export class InvalidModelUsageError extends Error {
  message = 'Invalid use of @model API';
}

type HandledPathExpressions = WeakSet<syntax.ASTv1.PathExpression>;

export interface Options {
  usageMeta: TemplateUsageMeta;
  debugPath?: string;
}

type ScopeValue =
  | { type: '@fields'; path: string }
  | { type: '@model'; path: string }
  | { type: 'stringLiteral'; value: string }
  | { type: 'pathExpression'; value: string };

export default function glimmerTemplateAnalyze(source: string, options: Options): void {
  try {
    syntax.preprocess(source, {
      mode: 'codemod',
      plugins: {
        ast: [cardTransformPlugin(options.usageMeta)],
      },
      meta: {
        moduleName: options.debugPath,
      },
    });
  } catch (error: any) {
    throw augmentBadRequest(error);
  }
}

export function cardTransformPlugin(meta: TemplateUsageMeta): syntax.ASTPluginBuilder {
  return function transform(_env: syntax.ASTPluginEnvironment): syntax.ASTPlugin {
    let handledPathExpressions: HandledPathExpressions = new WeakSet();
    let scopeTracker = new ScopeTracker<ScopeValue>();

    function trackFieldUsage(path: string, format: Format | 'default' = 'default') {
      if (path === '') {
        meta.fields = 'self';
      }
      if (meta.fields !== 'self') {
        meta.fields.set(path, format);
      }
    }

    function lookupScopeVal(
      fullPath: string,
      path: syntax.WalkerPath<syntax.ASTv1.Node>
    ): ReturnType<ScopeTracker<ScopeValue>['lookup']> {
      let [head, ...tail] = fullPath.split('.');
      let result = scopeTracker.lookup(head, path);
      if (
        result.type === 'assigned' &&
        (result.value.type === '@fields' || result.value.type === '@model') &&
        tail.length > 0
      ) {
        return {
          type: 'assigned',
          value: {
            type: result.value.type,
            path: result.value.path + '.' + tail.join('.'),
          },
        };
      }

      return result;
    }

    function trackScopeIfLoopingOverSpecificPath(node: syntax.ASTv1.BlockStatement) {
      let [param] = node.params;
      if (
        node.path.type === 'PathExpression' &&
        node.path.original === 'each' &&
        param?.type === 'PathExpression' &&
        param.head.type === 'AtHead' &&
        (param.head.name === '@model' || param.head.name === '@fields')
      ) {
        scopeTracker.assign(
          node.program.blockParams[0],
          { type: param.head.name, path: param.tail.join('.') },
          { onNextScope: true }
        );
        handledPathExpressions.add(param);
      }
    }

    function trackUsageIfEachInLoopOverFields(node: syntax.ASTv1.BlockStatement) {
      if (
        node.path.type === 'PathExpression' &&
        node.path.original === 'each-in' &&
        node.params[0]?.type === 'PathExpression' &&
        node.params[0].original === '@fields'
      ) {
        meta.fields = 'self';
        handledPathExpressions.add(node.params[0]);
      }
    }

    function trackModelUsage(path: string | undefined) {
      // If the model usage has already been set to self, adding a more precise
      // key is not neccessary, because all keys will be needed
      if (meta.model === 'self') {
        return;
      }
      // If we call this but turns out the path is empty, assume we want to track the whole model
      if (!path || path.length === 0) {
        meta.model = 'self';
        return;
      }

      meta.model.add(path);
    }

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          if (node.tag === '@fields') {
            throw new InvalidFieldsUsageError();
          }
          if (node.tag.startsWith('@model')) {
            throw new InvalidModelUsageError();
          }

          let fieldFullPath = fieldPathForElementNode(node);
          if (fieldFullPath) {
            return trackFieldUsage(fieldFullPath, 'default');
          }

          let result = lookupScopeVal(node.tag, path);
          if (result.type === 'assigned') {
            switch (result.value.type) {
              case '@fields':
                trackFieldUsage(result.value.path);
                break;
              case '@model':
                throw new InvalidModelUsageError();
            }
          }
        },

        PathExpression(node, path) {
          if (handledPathExpressions.has(node)) {
            return;
          }

          let result = lookupScopeVal(node.original, path);
          switch (result.type) {
            case 'normal':
              if (node.original.startsWith('@fields')) {
                throw new InvalidFieldsUsageError();
              }

              if (node.head.type === 'AtHead' && node.head.name === '@model') {
                trackModelUsage(node.tail.join('.'));
              }
              break;
            case 'assigned':
              if (result.value.type === '@model') {
                trackModelUsage(result.value.path);
              }
              if (result.value.type === '@fields') {
                throw new InvalidFieldsUsageError();
              }
              break;
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
            trackScopeIfLoopingOverSpecificPath(node);
          },
          exit() {},
        },
      },
    };
  };
}

function fieldPathForElementNode(node: syntax.ASTv1.ElementNode): string | undefined {
  if (node.tag.startsWith(`@fields.`)) {
    return node.tag.slice(`@fields.`.length);
  }
  return undefined;
}
