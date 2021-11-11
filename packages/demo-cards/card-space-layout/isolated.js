import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import './isolated.css';

export default setComponentTemplate(
  precompileTemplate(
    `<article class="card-space-layout">
      <div class="card-space-layout__cover-photo"><@fields.coverPhoto/></div>
      <section class="card-space-layout__modules card-space-layout__modules--xs">
        <@fields.profile/>
      </section>
      <section class="card-space-layout__modules card-space-layout__modules--md">
        <@fields.bio/>
        <@fields.links/>
        <@fields.donations/>
      </section>
    </article>`,
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
