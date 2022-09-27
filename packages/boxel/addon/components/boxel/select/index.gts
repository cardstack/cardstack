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
  | 'disabled'
>;

interface Args<ItemT> extends BasePowerSelectArgs { 
  options: ItemT[];
}

interface Signature<ItemT = any> {
  Element: HTMLDivElement;
  Args: Args<ItemT>,
  Blocks: {
    default: [ItemT, string];
  };
}


const BoxelSelect: TemplateOnlyComponent<Signature> = 
<template>
  <PowerSelect
    class={{cn "boxel-select" boxel-select--selected=@selected}}
    @options={{@options}}
    @selected={{@selected}}
    @selectedItemComponent={{@selectedItemComponent}}
    @placeholder={{@placeholder}}
    @onChange={{@onChange}}
    @renderInPlace={{@renderInPlace}}
    @verticalPosition={{@verticalPosition}}
    @dropdownClass={{cn "boxel-select__dropdown" @dropdownClass}}
    @triggerComponent={{@triggerComponent}}
    @disabled={{@disabled}}
    @eventType="click"
    ...attributes
    as |item|
  >
    {{yield item "boxel-select__item"}}
  </PowerSelect>
</template>


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Select': typeof BoxelSelect;
  }
}

export default BoxelSelect;
