import Component from '@glimmer/component';
import BoxelButton from '../../button';
import cn from '@cardstack/boxel/helpers/cn';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import './index.css';

interface Signature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: {
    icon?: string;
    label: string | number | undefined;
    isMissingValue?: boolean
  }
}

export default class BoxelDropdownTrigger extends Component <Signature>{
  <template>
    <BoxelButton
      class={{cn "boxel-dropdown-trigger" boxel-dropdown-trigger--showing-placeholder=@isMissingValue}}
      ...attributes
    >
      {{#if @icon}}
        {{svgJar @icon class="boxel-dropdown-trigger__icon" role="presentation"}}
      {{/if}}
      {{@label}}
      {{svgJar "caret-down" class="boxel-dropdown-trigger__caret" width=8 height=8 role="presentation"}}
    </BoxelButton>
  </template>
}