import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<section class="bio">
      <header class="bio__header"><@fields.name/></header>
      <p><@fields.description/></p>
    </section>`,
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
