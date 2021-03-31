import { precompile } from '@glimmer/compiler';
import type { TemplateFactory } from 'htmlbars-inline-precompile';

// @ts-ignore
import { createTemplateFactory } from '@ember/template-factory';

export function compileTemplate(source: string): TemplateFactory {
  return createTemplateFactory(JSON.parse(precompile(source)));
}

export function templateOnlyComponentTemplate(template: string): string {
  return `import { setComponentTemplate } from '@ember/component';
  import { precompileTemplate } from '@ember/template-compilation';
  import templateOnlyComponent from '@ember/component/template-only';

  export default setComponentTemplate(
    precompileTemplate('${template}', {
      strictMode: true,
    }),
    templateOnlyComponent()
  );`;
}
