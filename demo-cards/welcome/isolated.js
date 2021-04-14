import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
export default setComponentTemplate(
  precompileTemplate('<h1><marquee>👋 Welcome to my website</marquee></h1>', {
    strictMode: true,
    scope: {},
  }),
  templateOnlyComponent()
);
