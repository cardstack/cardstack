import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<section class="links">
      <header class="links__header">My Links</header>
      <ul class="links__list">
        <@fields.links/>
      </ul>
    </section>`,
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
