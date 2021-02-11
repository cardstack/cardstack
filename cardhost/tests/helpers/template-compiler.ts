import { precompile } from '@glimmer/compiler';
import type { TemplateFactory } from 'htmlbars-inline-precompile';

// @ts-ignore
import { createTemplateFactory } from '@ember/template-factory';

export function compileTemplate(source: string): TemplateFactory {
  return createTemplateFactory(JSON.parse(precompile(source)));
}
