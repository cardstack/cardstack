import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<li class="link">
      <div class="link__title"><@fields.linkTitle/></div>
      <div class="link__url"><@fields.url/></div>
    </li>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
