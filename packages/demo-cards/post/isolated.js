import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
export default setComponentTemplate(
  precompileTemplate(
    '<h1><@fields.title/></h1><article><@fields.body/> <div>Created At: <@fields.createdAt /></div></article>',
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
