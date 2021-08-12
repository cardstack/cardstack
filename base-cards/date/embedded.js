import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';

import Component from '@glimmer/component';

// The Intl API is supported in all modern browsers. In older ones, we polyfill
// it in the application route at app startup.
const Format = new Intl.DateTimeFormat('us-EN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const FormatDate = setComponentTemplate(
  precompileTemplate('{{this.formatted}}', {
    strictMode: true,
    scope: () => ({}),
  }),
  class extends Component {
    get formatted() {
      if (this.args.date) {
        return Format.format(this.args.date);
      }
    }
  }
);

export default setComponentTemplate(
  precompileTemplate('<FormatDate @date={{@model}} />', {
    strictMode: true,
    scope: () => ({ FormatDate }),
  }),
  templateOnlyComponent()
);
