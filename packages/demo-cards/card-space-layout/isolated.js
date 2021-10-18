import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import './isolated.css';

export default setComponentTemplate(
  precompileTemplate(
    '<article class="card-space-layout"><section class="card-space-layout__module"><@fields.profile/></section><section class="card-space-layout__optional-modules"><@fields.bio/><@fields.links/><@fields.donations/></section></article>',
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
