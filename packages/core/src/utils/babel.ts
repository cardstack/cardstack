import { NodePath } from '@babel/core';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';

export function name(node: t.StringLiteral | t.Identifier, t: typeof Babel.types): string {
  if (t.isIdentifier(node)) {
    return node.name;
  } else {
    return node.value;
  }
}

export function getObjectKey(
  obj: NodePath<t.ObjectExpression>,
  key: string,
  t: typeof Babel.types
): NodePath<t.Expression> | undefined {
  for (let prop of obj.get('properties')) {
    if (prop.isObjectProperty() && !prop.node.computed) {
      let propKey = (prop as NodePath<t.ObjectProperty>).get('key');
      if ((propKey.isStringLiteral() || propKey.isIdentifier()) && name(propKey.node, t) === key) {
        return prop.get('value') as NodePath<t.Expression>;
      }
    }
  }
  return undefined;
}

export function error(path: NodePath<any>, message: string) {
  return path.buildCodeFrameError(message, CompilerError);
}

export type ImportDetails = Map<string, { moduleSpecifier: string; exportedName: string }>;

export function addImports(neededImports: ImportDetails, path: NodePath<t.Program>, t: typeof Babel.types) {
  for (let [localName, { moduleSpecifier, exportedName }] of neededImports) {
    path.node.body.push(
      t.importDeclaration(
        [
          exportedName === 'default'
            ? t.importDefaultSpecifier(t.identifier(localName))
            : t.importSpecifier(t.identifier(localName), t.identifier(exportedName)),
        ],
        t.stringLiteral(moduleSpecifier)
      )
    );
  }
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
