import PowerSelect, { PatchedPowerSelectArgs }  from 'ember-power-select/components/power-select';
import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '@cardstack/boxel/helpers/cn';

import './index.css';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

type BasePowerSelectArgs = PartialBy<Pick<
  PatchedPowerSelectArgs,
  | 'searchField'
  | 'selected'
  | 'selectedItemComponent'
  | 'placeholder'
  | 'onChange'
  | 'onBlur'
  | 'renderInPlace'
  | 'verticalPosition'
  | 'dropdownClass'
  | 'triggerComponent'
  | 'disabled'
>, 'disabled'|'renderInPlace'>;

export interface BoxelSelectArgs<ItemT> extends BasePowerSelectArgs { 
  options: ItemT[];
}

interface Signature<ItemT = any> {
  Element: HTMLDivElement;
  Args: BoxelSelectArgs<ItemT>,
  Blocks: {
    default: [ItemT, string];
  };
}


const BoxelSelect: TemplateOnlyComponent<Signature> = 
<template>
  <PowerSelect
    class={{cn "boxel-select" boxel-select--selected=@selected}}
    @options={{@options}}
    @searchField={{@searchField}}
    @selected={{@selected}}
    @selectedItemComponent={{@selectedItemComponent}}
    @placeholder={{@placeholder}}
    @onChange={{@onChange}}
    @onBlur={{@onBlur}}
    @renderInPlace={{@renderInPlace}}
    @verticalPosition={{@verticalPosition}}
    @dropdownClass={{cn "boxel-select__dropdown" @dropdownClass}}
    @triggerComponent={{@triggerComponent}}
    @disabled={{@disabled}}
    @matchTriggerWidth={{false}}
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
