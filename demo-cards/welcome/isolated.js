import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import './isolated.css';

export default setComponentTemplate(
  precompileTemplate(
    '<div class="welcome-isolated"><h1><marquee>👋 Welcome to my website</marquee></h1></div>',
    {
      strictMode: true,
      scope: () => ({}),
    }
  ),
  templateOnlyComponent()
);
