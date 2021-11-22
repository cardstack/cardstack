import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(`<div class="background"><@fields.coverPhoto/></div>`, {
    strictMode: true,
    scope: () => ({}),
  }),
  templateOnlyComponent()
);
