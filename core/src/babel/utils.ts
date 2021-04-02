import { NodePath } from '@babel/core';
import {
  StringLiteral,
  Expression,
  Identifier,
  isIdentifier,
  ObjectExpression,
  ObjectProperty,
} from '@babel/types';

export function name(node: StringLiteral | Identifier): string {
  if (isIdentifier(node)) {
    return node.name;
  } else {
    return node.value;
  }
}

export function getObjectKey(
  obj: NodePath<ObjectExpression>,
  key: string
): NodePath<Expression> | undefined {
  for (let prop of obj.get('properties')) {
    if (prop.isObjectProperty() && !prop.node.computed) {
      let propKey = (prop as NodePath<ObjectProperty>).get('key');
      if (
        (propKey.isStringLiteral() || propKey.isIdentifier()) &&
        name(propKey.node) === key
      ) {
        return prop.get('value') as NodePath<Expression>;
      }
    }
  }
  return undefined;
}

export function error(path: NodePath<any>, message: string) {
  return path.buildCodeFrameError(message, CompilerError);
}

class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompilerError';
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else if (!this.stack) {
      this.stack = new Error(message).stack;
    }
  }
}

// @ts-ignore
export { default as ColocatedBabelPlugin } from 'ember-cli-htmlbars/lib/colocated-babel-plugin';
