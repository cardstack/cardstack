import or from 'ember-truth-helpers/helpers/or';
import PowerSelect, { PatchedPowerSelectArgs }  from 'ember-power-select/components/power-select';
import type { TemplateOnlyComponent } from '@ember/component/template-only';

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
>;

interface Args<ItemT> extends BasePowerSelectArgs { 
  items: ItemT[];
  eventType?: PatchedPowerSelectArgs['eventType']
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
    @options={{@items}}
    @selected={{@selected}}
    @selectedItemComponent={{@selectedItemComponent}}
    @placeholder={{@placeholder}}
    @onChange={{@onChange}}
    @renderInPlace={{@renderInPlace}}
    @verticalPosition={{@verticalPosition}}
    @dropdownClass={{@dropdownClass}}
    @triggerComponent={{@triggerComponent}}
    @eventType={{or @eventType defaultEventType}}
    ...attributes
    as |item|
  >
    {{yield item}}
  </PowerSelect>
</template>


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Select': typeof BoxelSelect;
  }
}

export default BoxelSelect;
