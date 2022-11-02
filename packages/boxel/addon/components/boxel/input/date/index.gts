import Component from '@glimmer/component';
import BoxelDropdown from '../../dropdown';
import BoxelCalendar, { Day } from '../../calendar';
import BoxelButton from '../../button';
import registerElement from '@cardstack/boxel/modifiers/register-element';
import set from 'ember-set-helper/helpers/set';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array, hash } from '@ember/helper';
import { default as Owner } from '@ember/owner';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export { Day };

interface ComponentArgs {
  value?: Day;
  onChange: (val: Day) => void;
}

interface Signature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: ComponentArgs;
}

export default class BoxelInputDate extends Component<Signature> {
  get dateString() {
    return this.args.value?.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  }
  constructor(owner: Owner, args: ComponentArgs) {
    super(owner, args);
    this.center = this.args.value || new Date();
  }
  center: Day;

  <template>
    <BoxelDropdown
      class="boxel-input-date"
      data-test-boxel-input-date
    >
      <:trigger as |bindings|>
        <BoxelButton
          {{bindings}}
          {{registerElement (set this 'triggerElement')}}
          class="boxel-input-date__trigger"
          data-test-boxel-input-date-trigger
          ...attributes
        >
          {{svgJar 'calendar' class="boxel-input-date__icon" role="presentation"}}
          {{this.dateString}}
          {{svgJar "caret-down" class="boxel-input-date__caret" width=8 height=8 role="presentation"}}
        </BoxelButton>
      </:trigger>
      <:content>
        <div
          class="boxel-input-date__calendar-container"
          {{registerElement (set this 'containerElement')}}
        >
          <BoxelCalendar
            @selected={{this.args.value}}
            @onSelect={{this.args.onChange}}
            @center={{this.center}}
            @onCenterChange={{fn (mut this.center)}}
          />
        </div>
      </:content>
    </BoxelDropdown>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::Date': typeof BoxelInputDate;
  }
}
