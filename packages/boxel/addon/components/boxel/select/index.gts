import or from 'ember-truth-helpers/helpers/or';
import PowerSelect, { PatchedPowerSelectArgs }  from 'ember-power-select/components/power-select';
import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '@cardstack/boxel/helpers/cn';

import './index.css';

type BasePowerSelectArgs = Pick<
  PatchedPowerSelectArgs,
  | 'selected'
  | 'selectedItemComponent'
  | 'placeholder'
  | 'onChange'
  | 'renderInPlace'
  | 'verticalPosition'
  | 'dropdownClass'
  | 'triggerComponent' 
  | 'eventType'
>;

interface Args<ItemT> extends BasePowerSelectArgs { 
  options: ItemT[];
  selectClass?: string;
  itemClass?: string;
  defaultItemStyles?: boolean;
}

interface Signature<ItemT = any> {
  Element: HTMLDivElement;
  Args: Args<ItemT>,
  Blocks: {
    default: [ItemT];
  };
}

const defaultEventType = 'click' as const;

const BoxelSelect: TemplateOnlyComponent<Signature> = 
<template>
  <PowerSelect
    class={{cn "boxel-select" @selectClass boxel-select--selected=@selected}}
    @options={{@options}}
    @selected={{@selected}}
    @selectedItemComponent={{@selectedItemComponent}}
    @placeholder={{@placeholder}}
    @onChange={{@onChange}}
    @renderInPlace={{@renderInPlace}}
    @verticalPosition={{@verticalPosition}}
    @dropdownClass={{or @dropdownClass (cn "boxel-select__dropdown")}}
    @triggerComponent={{@triggerComponent}}
    @eventType={{or @eventType defaultEventType}}
    ...attributes
    as |item|
  >
    <div
      class={{cn
        "boxel-select__item"
        @itemClass
        boxel-select__item--default=@defaultItemStyles
      }}
    >{{yield item}}</div>
  </PowerSelect>
</template>


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Select': typeof BoxelSelect;
  }
}

export default BoxelSelect;
