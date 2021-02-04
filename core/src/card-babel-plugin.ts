import {
  ImportDeclaration,
  ImportSpecifier,
  variableDeclaration,
  variableDeclarator,
  identifier,
  objectPattern,
  objectProperty,
  callExpression,
  stringLiteral,
} from '@babel/types';
import { NodePath } from '@babel/traverse';

export default function main() {
  return {
    visitor: {
      ImportDeclaration(path: NodePath<ImportDeclaration>) {
        if (path.node.source.value === '@cardstack/types') {
          let specifiers = path.node.specifiers.filter(
            (specifier) => specifier.type === 'ImportSpecifier'
          ) as ImportSpecifier[];
          path.replaceWith(
            variableDeclaration('const', [
              variableDeclarator(
                objectPattern(
                  specifiers.map((s) =>
                    objectProperty(s.imported, s.local, false, true)
                  )
                ),
                callExpression(identifier('require'), [
                  stringLiteral('@cardstack/core'),
                ])
              ),
            ])
          );
          return;
        }

        let prefix = 'https://cardstack.com/base/';
        if (path.node.source.value.startsWith(prefix)) {
          path.node.source.value =
            path.node.source.value.replace(
              prefix,
              'http://localhost:4200/base/'
            ) + '.js';
        }
      },
    },
  };
}
