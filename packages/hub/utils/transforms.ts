import type { types as t, BabelFileResult } from '@babel/core';
import { transformFromAstSync, transformSync } from '@babel/core';
// @ts-ignore
import TransformModulesCommonJS from '@babel/plugin-transform-modules-commonjs';
// @ts-ignore
import ClassPropertiesPlugin from '@babel/plugin-proposal-class-properties';

export function transformToCommonJS(moduleURL: string, source: string, ast: t.File | undefined): string {
  let out: BabelFileResult | null;
  let options = {
    configFile: false,
    babelrc: false,
    filenameRelative: moduleURL,
    plugins: [ClassPropertiesPlugin, TransformModulesCommonJS],
  };
  if (ast) {
    out = transformFromAstSync(ast, source, options);
  } else {
    out = transformSync(source, options);
  }

  return out!.code!;
}
