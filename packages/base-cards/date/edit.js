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
    "<input type='date' value={{this.formatted}} ...attributes />",
    {
      strictMode: true,
      scope: () => ({}), // NOTE: this is tricking our inline detector into not inlining this component
    }
  ),
  class extends Component {
    get formatted() {
      let d = this.args.model;
      if (d) {
        return makeDateInputHappy(d);
      }
    }
  }
);

function pad(str, length) {
  str = String(str);
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}

function makeDateInputHappy(d) {
  return `${d.getYear() + 1900}-${pad(d.getMonth() + 1, 2)}-${pad(
    d.getDate(),
    2
  )}`;
}
