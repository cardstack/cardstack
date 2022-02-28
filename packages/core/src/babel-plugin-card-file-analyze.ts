import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { BabelFileResult, transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import { name } from './utils/babel';
import { augmentBadRequest } from './utils/errors';

// @ts-ignore
import decoratorsSyntaxPlugin from '@babel/plugin-syntax-decorators';
// @ts-ignore
import classPropertiesSyntaxPlugin from '@babel/plugin-syntax-class-properties';

interface State {
  opts: any;
}

export interface ExportMeta {
  name: 'default' | string;
  type: t.Declaration['type'];
}

export interface FileMeta {
  exports?: ExportMeta[];
}

const metas = new WeakMap<State['opts'], FileMeta>();

function getMeta(obj: State['opts']): FileMeta {
  let meta = metas.get(obj);
  if (!meta) {
    return {};
  }
  return meta;
}

export default function (
  source: string,
  options: any
): { code: BabelFileResult['code']; ast: BabelFileResult['ast']; meta: FileMeta } {
  let out: BabelFileResult;
  try {
    out = transformSync(source, {
      ast: true,
      plugins: [
        [babelPluginCardFileAnalyze, options],
        [decoratorsSyntaxPlugin, { decoratorsBeforeExport: false }],
        classPropertiesSyntaxPlugin,
      ],
    })!;
  } catch (error: any) {
    throw augmentBadRequest(error);
  }

  return {
    code: out!.code,
    ast: out!.ast,
    meta: getMeta(options),
  };
}

export function babelPluginCardFileAnalyze(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>, state: State) {
        switch (path.node.declaration?.type) {
          case 'FunctionDeclaration':
            storeExportMeta(state.opts, {
              name: name(path.node.declaration.id!, t),
              type: path.node.declaration.type,
            });
            break;
          case 'VariableDeclaration':
            for (const dec of path.node.declaration.declarations) {
              if (t.isIdentifier(dec.id)) {
                storeExportMeta(state.opts, {
                  name: dec.id.name,
                  type: path.node.declaration.type,
                });
              }
            }
            break;
        }
      },
      ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>, state: State) {
        // Not sure what to do with expressions
        if (!t.isExpression(path.node.declaration)) {
          storeExportMeta(state.opts, {
            name: 'default',
            type: path.node.declaration.type,
          });
        }
      },
    },
  };
}

function storeExportMeta(key: State['opts'], exportMeta: ExportMeta) {
  let meta = getMeta(key);
  if (!meta.exports) {
    meta.exports = [exportMeta];
  } else {
    meta.exports.push(exportMeta);
  }
  metas.set(key, meta);
}
