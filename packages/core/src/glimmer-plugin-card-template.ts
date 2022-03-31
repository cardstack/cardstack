import * as syntax from '@glimmer/syntax';
import type {
  PathExpression,
  ElementNode,
  BlockStatement,
  Statement,
  Node,
} from '@glimmer/syntax/dist/types/lib/v1/api';
import { assertIsField, Field, Format } from './interfaces';
import { singularize } from 'inflection';
import { cloneDeep } from 'lodash';
import { classify } from './utils';
import { augmentBadRequest } from './utils/errors';
import { getFieldForPath } from './utils/fields';
import { ScopeTracker } from './glimmer-scope-tracker';
import { FieldsWithPlaceholders, FieldWithPlaceholder } from './compiler';

const IN_PROCESS_ELEMENT_ESCAPE = '__';
class InvalidFieldsUsageError extends Error {
  message = 'Invalid use of @fields API';
}

type ImportAndChooseName = (desiredName: string, moduleSpecifier: string, importedName: string) => string;

export interface Options {
  fields: FieldsWithPlaceholders;
  defaultFieldFormat: Format;
  debugPath?: string;
  importAndChooseName: ImportAndChooseName;
}

interface FieldComponent {
  type: 'fieldComponent';
  field: FieldWithPlaceholder;
  pathForModel: string;
  fieldFullPath: string;
  expandable: boolean;
}

type ScopeValue =
  | FieldComponent
  | {
      type: 'stringLiteral';
      value: string;
    }
  | {
      type: 'pathExpression';
      value: string;
    };

interface State {
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
          moduleName: options.debugPath,
        },
      })
    );
  } catch (error: any) {
    throw augmentBadRequest(error);
  }
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(env: syntax.ASTPluginEnvironment): syntax.ASTPlugin {
    let { fields, importAndChooseName, defaultFieldFormat } = options;
    let state: State = {
      handledFieldExpressions: new WeakSet(),
      handledModelExpressions: new WeakSet(),
    };
    let scopeTracker = new ScopeTracker<ScopeValue>();

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          if (node.tag === '@fields') {
            throw new InvalidFieldsUsageError();
          }

          let fieldFormat = getFieldFormat(node);
          let fieldFullPath = fieldPathForElementNode(node);

          if (fieldFullPath) {
            let field = getFieldForPath(fields, fieldFullPath);
            if (!field) {
              throw new Error(`unknown field ${fieldFullPath}`);
            }
            if (field.type === 'containsMany') {
              return expandContainsManyShorthand(`@fields.${fieldFullPath}`);
            }
            return rewriteElementNode({
              field,
              importAndChooseName,
              modelArgument: `@model.${fieldFullPath}`,
              format: field.computed ? 'embedded' : fieldFormat === 'default' ? defaultFieldFormat : fieldFormat,
              state,
              scopeTracker,
            });
          }

          let { tag } = node;
          if (tag.startsWith(IN_PROCESS_ELEMENT_ESCAPE)) {
            tag = tag.replace(IN_PROCESS_ELEMENT_ESCAPE, '');
          } else if (!/[A-Z]/.test(tag[0])) {
            // not a possible invocation of a local variable
            return;
          }

          let result = lookupScopeVal(tag, path, scopeTracker);
          switch (result.type) {
            case 'normal':
              return;
            case 'assigned': {
              let { value } = result;
              switch (value.type) {
                case 'stringLiteral':
                  throw new Error(`tried to replace a component invocation with a string literal`);
                case 'pathExpression':
                  throw new Error(`tried to replace a component invocation with a path expression`);
                case 'fieldComponent':
                  if (value.expandable && value.field.type === 'containsMany') {
                    return expandContainsManyShorthand(`@fields.${value.fieldFullPath}`);
                  }
                  return rewriteElementNode({
                    field: value.field,
                    importAndChooseName,
                    modelArgument: value.pathForModel,
                    format: value.field.computed
                      ? 'embedded'
                      : fieldFormat === 'default'
                      ? defaultFieldFormat
                      : fieldFormat,
                    state,
                    scopeTracker,
                  });
                default:
                  throw assertNever(value);
              }
            }
            default:
              throw assertNever(result);
          }
        },

        PathExpression(node, path) {
          if (state.handledFieldExpressions.has(node)) {
            let pathTail = node.original.slice(`@fields.`.length);

            let newExpression = env.syntax.builders.path(`@model.${pathTail}`);
            state.handledModelExpressions.add(newExpression);
            return newExpression;
          }

          let result = scopeTracker.lookup(node.original, path);
          switch (result.type) {
            case 'normal':
              if (isFieldPathExpression(node)) {
                throw new InvalidFieldsUsageError();
              }

              return;
            case 'assigned': {
              let { value } = result;
              switch (value.type) {
                case 'stringLiteral':
                  return env.syntax.builders.string(value.value);
                case 'pathExpression':
                  return env.syntax.builders.path(value.value);
                case 'fieldComponent':
                  return;
                default:
                  throw assertNever(value);
              }
            }
            default:
              throw assertNever(result);
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
            let handled: { replacement?: unknown } | undefined = handleFieldsIterator(node, fields, scopeTracker);
            if (handled) {
              return handled.replacement;
            }
            scopeTracker.blockStatementEnter(node);
            handlePluralFieldIterator(node, fields, state, scopeTracker);
          },
          exit() {},
        },
      },
    };
  };
}

function lookupScopeVal(
  fullPath: string,
  path: syntax.WalkerPath<Node>,
  scopeTracker: ScopeTracker<ScopeValue>
): ReturnType<ScopeTracker<ScopeValue>['lookup']> {
  let [head, ...tail] = fullPath.split('.');
  let result = scopeTracker.lookup(head, path);
  if (result.type !== 'assigned' || result.value.type !== 'fieldComponent' || tail.length === 0) {
    return result;
  }
  // unsure if this is correct...
  if (result.value.field.card === 'self') {
    return { type: 'normal' };
  }
  let field = getFieldForPath(result.value.field.card.fields, tail.join('.'));
  if (field) {
    return {
      type: 'assigned',
      value: {
        type: 'fieldComponent',
        field,
        pathForModel: fullPath,
        fieldFullPath: result.value.fieldFullPath + '.' + tail.join('.'),
        expandable: true,
      },
    };
  }
  return { type: 'normal' };
}

function handleFieldsIterator(
  node: BlockStatement,
  fields: FieldsWithPlaceholders,
  scopeTracker: ScopeTracker<ScopeValue>
): { replacement: syntax.ASTv1.Statement[] } | undefined {
  if (!isFieldsIterator(node)) {
    return;
  }

  let replacement: syntax.ASTv1.Statement[] = [];

  for (let [name, field] of Object.entries(fields)) {
    let copied = cloneDeep(node.program.body);
    for (let copiedNode of copied) {
      if (node.program.blockParams[0]) {
        scopeTracker.assign(
          node.program.blockParams[0],
          {
            type: 'stringLiteral',
            value: name,
          },
          {
            inside: copiedNode,
          }
        );
      }
      if (node.program.blockParams[1]) {
        scopeTracker.assign(
          node.program.blockParams[1],
          {
            type: 'fieldComponent',
            field: field,
            pathForModel: `@model.${name}`,
            fieldFullPath: name,
            expandable: true,
          },
          {
            inside: copiedNode,
          }
        );
      }
    }
    replacement = replacement.concat(copied);
  }

  return { replacement };
}

function handlePluralFieldIterator(
  node: BlockStatement,
  fields: FieldsWithPlaceholders,
  state: State,
  scopeTracker: ScopeTracker<ScopeValue>
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

  if (node.program.blockParams[0]) {
    scopeTracker.assign(
      node.program.blockParams[0],
      {
        type: 'fieldComponent',
        field,
        pathForModel: node.program.blockParams[0],
        fieldFullPath,
        expandable: false,
      },
      {
        onNextScope: true,
      }
    );
  }
}

function rewriteElementNode(options: {
  field: FieldWithPlaceholder;
  modelArgument: string;
  importAndChooseName: Options['importAndChooseName'];
  state: State;
  scopeTracker: ScopeTracker<ScopeValue>;
  format: Format;
}): Statement[] {
  let { field, modelArgument, state, scopeTracker, format } = options;
  if (field.card === 'self') {
    // This will be filled in when we replace the placeholders
    return [];
  }
  assertIsField(field);

  let { inlineHBS } = field.card.componentInfos[format];

  if (inlineHBS) {
    return inlineTemplateForField(inlineHBS, modelArgument, scopeTracker);
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

  let componentName = importAndChooseName(
    classify(field.card.url),
    field.card.componentInfos[format].componentModule.global,
    'default'
  );

  let modelExpression = path(modelArgument);
  state.handledModelExpressions.add(modelExpression);
  let attrs = [attr('@model', mustache(modelExpression)), attr('data-test-field-name', text(field.name))];

  if (format === 'edit') {
    let setterArg = modelArgument.replace('@model.', '');
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
  return exp.original.startsWith('@fields');
}

function fieldPathForPathExpression(exp: PathExpression): string | undefined {
  if (isFieldPathExpression(exp)) {
    return exp.tail.join('.');
  }
  return undefined;
}

function fieldPathForElementNode(node: ElementNode): string | undefined {
  if (node.tag.startsWith(`@fields.`)) {
    return node.tag.slice(`@fields.`.length);
  }
  return undefined;
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}

function inlineTemplateForField(
  inlineHBS: string,
  fieldName: string,
  scopeTracker: ScopeTracker<ScopeValue>
): syntax.ASTv1.Statement[] {
  let { body } = syntax.preprocess(inlineHBS, {});
  for (let statement of body) {
    scopeTracker.assign(
      '@model',
      {
        type: 'pathExpression',
        value: fieldName,
      },
      { inside: statement }
    );
  }
  return body;
}

function getFieldFormat(_node: ElementNode): Format | 'default' {
  // TODO: look at @format parameter on node to override default
  return 'default';
}
