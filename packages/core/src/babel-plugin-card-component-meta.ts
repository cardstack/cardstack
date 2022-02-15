// import ETC from 'ember-source/dist/ember-template-compiler';
// const { preprocess, print } = ETC._GlimmerSyntax;

import { transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';

import { CompiledCard, SerializerName, SerializerMap } from './interfaces';

import { buildSerializerMapFromUsedFields } from './utils/fields';
import { augmentBadRequest } from './utils/errors';

export interface CardComponentMetaPluginOptions {
  debugPath: string;
  fields: CompiledCard['fields'];
  // these are for gathering output
  usedFields: string[];
  serializerMap: SerializerMap;
}

interface State {
  opts: CardComponentMetaPluginOptions;
}

export default function (options: CardComponentMetaPluginOptions): { source: string; ast: t.File } {
  try {
    let out = transformSync('', {
      ast: true,
      plugins: [[babelPluginComponentMeta, options]],
      // HACK: The / resets the relative path setup, removing the cwd of the hub.
      // This allows the error module to look a lot more like the card URL.
      filename: '/' + options.debugPath.replace(/^\//, ''),
    });
    return { source: out!.code!, ast: out!.ast! };
  } catch (e: any) {
    throw augmentBadRequest(e);
  }
}

export function babelPluginComponentMeta(babel: typeof Babel) {
  return {
    visitor: {
      Program: {
        exit(path: NodePath<t.Program>, state: State) {
          addComponentMetaExport(path, state, babel);
        },
      },
    },
  };
}

function addComponentMetaExport(path: NodePath<t.Program>, state: State, babel: typeof Babel) {
  let t = babel.types;
  let serializerMap = buildSerializerMapFromUsedFields(state.opts.fields, state.opts.usedFields);
  state.opts.serializerMap = serializerMap;

  path.node.body.push(
    babel.template(`
      export const ComponentMeta = {
          serializerMap: %%serializerMap%%,
          computedFields: %%computedFields%%,
          usedFields: %%usedFields%%
        };
      `)({
      serializerMap: t.objectExpression(buildSerializerMapProp(serializerMap, t)),
      computedFields: t.arrayExpression(
        Object.values(state.opts.fields)
          .filter((field) => field.computed)
          .map((field) => t.stringLiteral(field.name))
      ),
      usedFields: t.arrayExpression(state.opts.usedFields.map((field) => t.stringLiteral(field))),
    }) as t.Statement
  );
}

function buildSerializerMapProp(serializerMap: SerializerMap, t: typeof Babel.types): t.ObjectExpression['properties'] {
  let props: t.ObjectExpression['properties'] = [];

  for (let serializer in serializerMap) {
    let fieldList = serializerMap[serializer as SerializerName];
    if (!fieldList) {
      continue;
    }

    let fieldListElements: t.ArrayExpression['elements'] = [];
    for (let field of fieldList) {
      fieldListElements.push(t.stringLiteral(field));
    }
    props.push(t.objectProperty(t.identifier(serializer), t.arrayExpression(fieldListElements)));
  }

  return props;
}
