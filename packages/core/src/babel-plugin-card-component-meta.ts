// import ETC from 'ember-source/dist/ember-template-compiler';
// const { preprocess, print } = ETC._GlimmerSyntax;

import { transformSync } from '@babel/core';
import { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';

import { CompiledCard, SerializerMap, Field } from './interfaces';

import { augmentBadRequest } from './utils/errors';
import { getFieldForPath } from './utils/fields';
import { capitalize } from 'lodash';

export interface CardComponentMetaPluginOptions {
  debugPath: string;
  fields: CompiledCard['fields'];
  // these are for gathering output
  usedFields: string[];
  serializerMap: SerializerMap;
}

interface State {
  importUtil: ImportUtil;
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
        enter(path: NodePath<t.Program>, state: State) {
          state.importUtil = new ImportUtil(babel.types, path);
        },
        exit(path: NodePath<t.Program>, state: State) {
          path.node.body.push(exportSerializerMap(path, state, babel));
          path.node.body.push(exportComputedFields(state, babel));
          path.node.body.push(exportUsedFields(state, babel));
        },
      },
    },
  };
}

function exportSerializerMap(path: NodePath<t.Program>, state: State, babel: typeof Babel): t.Statement {
  let t = babel.types;
  let { fields, usedFields } = state.opts;

  let map: SerializerModuleMap = {};

  for (const fieldPath of usedFields) {
    let field = getFieldForPath(fields, fieldPath);

    if (!field) {
      continue;
    }

    addFieldToSerializerMap(map, field, fieldPath, path, state);
  }

  return babel.template(`export const serializerMap = %%serializerMap%%;`)({
    serializerMap: t.objectExpression(buildSerializerMapProp(map, t)),
  }) as t.Statement;
}

function exportComputedFields(state: State, babel: typeof Babel): t.Statement {
  let t = babel.types;

  return babel.template(`export const computedFields = %%computedFields%%;`)({
    computedFields: t.arrayExpression(
      Object.values(state.opts.fields)
        .filter((field) => field.computed)
        .map((field) => t.stringLiteral(field.name))
    ),
  }) as t.Statement;
}

function exportUsedFields(state: State, babel: typeof Babel): t.Statement {
  let t = babel.types;

  return babel.template(`export const usedFields = %%usedFields%%;`)({
    usedFields: t.arrayExpression(state.opts.usedFields.map((field) => t.stringLiteral(field))),
  }) as t.Statement;
}

// TODO: Where
type SerializerModuleMap = Record<string, t.Identifier>;

function buildSerializerMapProp(
  serializerMap: SerializerModuleMap,
  t: typeof Babel.types
): t.ObjectExpression['properties'] {
  let props: t.ObjectExpression['properties'] = [];

  for (let fieldPath in serializerMap) {
    let modulePath = serializerMap[fieldPath];
    if (!modulePath) {
      continue;
    }

    props.push(t.objectProperty(t.stringLiteral(fieldPath), modulePath));
  }

  return props;
}

function addFieldToSerializerMap(
  map: SerializerModuleMap,
  field: Field,
  usedPath: string,
  path: NodePath<t.Program>,
  state: State
): void {
  if (Object.keys(field.card.fields).length) {
    let { fields } = field.card;
    for (const name in fields) {
      addFieldToSerializerMap(map, fields[name], `${usedPath}.${name}`, path, state);
    }
  } else {
    if (!field.card.serializerModule) {
      return;
    }
    // TEMP: Would be nice to have the Proper CardID on the compiled card
    let cardId = field.card.url.split('/')[field.card.url.split('/').length - 1];
    map[usedPath] = state.importUtil.import(
      path,
      field.card.serializerModule.global,
      '*',
      `${capitalize(cardId)}Serializer`
    );
  }
}
