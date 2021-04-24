import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
export default setComponentTemplate(
  precompileTemplate(
    '<h1><@model.title/></h1><article><@model.body/></article>',
    {
      strictMode: true,
      scope: {},
    }
  ),
  templateOnlyComponent()
);
