import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { BabelFileResult, transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import difference from 'lodash/difference';
import { name, error } from './utils/babel';
import { augmentBadRequest } from './utils/errors';

const REQUIRED_EXPORTS = ['serialize', 'deserialize'];

interface State {
  seenExports: string[];
}

export default function (schemaSrc: string): { code: BabelFileResult['code']; ast: BabelFileResult['ast'] } {
  let out: BabelFileResult;
  try {
    out = transformSync(schemaSrc, {
      ast: true,
      plugins: [[babelPluginCardSerializerAnalyze]],
    })!;
  } catch (error: any) {
    throw augmentBadRequest(error);
  }

  return {
    code: out!.code,
    ast: out!.ast,
  };
}

export function babelPluginCardSerializerAnalyze(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>, state: State) {
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          if (!state.seenExports) {
            state.seenExports = [];
          }
          state.seenExports.push(name(path.node.declaration.id, t));
        }
      },
      Program: {
        exit(path: NodePath<t.Program>, state: State) {
          let diff = difference(REQUIRED_EXPORTS, state.seenExports);
          if (diff.length) {
            throw error(path, `Serializer is malformed. It is missing the following exports: ${diff.join(', ')}`);
          }
        },
      },
    },
  };
}
