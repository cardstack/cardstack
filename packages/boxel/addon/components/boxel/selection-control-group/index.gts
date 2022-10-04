import Component from '@glimmer/component';
import BoxelSelectButton from '../select-button';
import BoxelDropdownButton from '../dropdown-button';
import BoxelMenu from '../menu';
import { type WithBoundArgs } from '@glint/template';

import cn from '@cardstack/boxel/helpers/cn';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { on } from '@ember/modifier';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLDivElement;
  Args: {
    isSelected: boolean;
    selectedItemCount?: number;
    mode?: any;
    menuComponent?: WithBoundArgs<typeof BoxelMenu, 'items'>;
    toggleSelectAll: () => void;
  };
  Blocks: {
    'default': [],
  }
}

export default class SelectionControlGroup extends Component<Signature> {
  get isPartial(): boolean {
    return !!this.args.selectedItemCount;
  }

  <template>
    <div
      class="boxel-selection-control-group"
      data-test-boxel-selection-control-group={{if
        @isSelected
        "selected"
        (if @selectedItemCount "partial" "none")
      }}
      ...attributes
    >
      <BoxelSelectButton
        class="boxel-selection-control-group__select-button"
        @mode={{@mode}}
        @isPartial={{this.isPartial}}
        @isSelected={{@isSelected}}
        data-test-boxel-selection-control-group-toggle
        {{on "click" @toggleSelectAll}}
      />
      <div
        class={{cn
          "boxel-selection-control-group__select-all"
          boxel-selection-control-group__select-all--selected-items=this.isPartial
        }}
      >
        {{#if @selectedItemCount}}
          {{svgJar "check-mark" width="9px" height="7px"}}
          {{@selectedItemCount}}
          selected
          {{#if @menuComponent}}
            <BoxelDropdownButton
              @button="more-actions"
              @icon="more-actions"
              class="boxel-selection-control-group__menu-trigger"
              as |ddb|
            >
              <@menuComponent @closeMenu={{ddb.close}} />
            </BoxelDropdownButton>
          {{/if}}
        {{else}}
          Select all
        {{/if}}
      </div>
    </div>
  </template>
}
