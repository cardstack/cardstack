/*
  ember-svg-jar ships its own code for the svg-jar helper in the `app` tree,
  which makes it un-importable from an addon like us.

  They seem to have fixed that on master
  (https://github.com/voltidev/ember-svg-jar/pull/213) but it is unreleased as
  of now.

  Until then, this vendors that small amount of code into our own utility here,
  along with some type annotations that are lacking upstream.
*/

// @ts-ignore
import makeSVG from 'ember-svg-jar/utils/make-svg';
import { importSync } from '@embroider/macros';

function getInlineAsset(assetId: string) {
  try {
    return (importSync(`ember-svg-jar/inlined/${assetId}`) as any).default;
  } catch (err) {
    return null;
  }
}

export function svgJar(
  assetId: string,
  svgAttrs: {
    width?: string;
    height?: string;
    class?: string;
    role?: string;
    title?: string;
    desc?: string;
  }
) {
  return makeSVG(assetId, svgAttrs, getInlineAsset);
}
