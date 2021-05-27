import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';
import { precompileTemplate } from '@ember/template-compilation';

const Format = new Intl.DateTimeFormat('us-EN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default setComponentTemplate(
  precompileTemplate(
    "TEST{{this.formatted}}TEST<input type='datetime-local' value='{{this.formatted}}' />",
    {
      strictMode: true,
    }
  ),
  class extends Component {
    get formatted() {
      console.log('WHAT');
      console.log('DATE EDIT', this.args.model);
      debugger;
      return Format.format(this.args.model);
    }
  }
);
