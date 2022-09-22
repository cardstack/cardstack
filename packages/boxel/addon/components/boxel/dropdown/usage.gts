import Component from '@glimmer/component';

import { action } from '@ember/object';
//@ts-expect-error glint does not think array is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array } from '@ember/helper';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';

import menuItem from '@cardstack/boxel/helpers/menu-item'

import BoxelButton from '../button'
import BoxelMenu from '../menu'

import BoxelDropdown from './index';


export default class BoxelDropdownUsage extends Component {
   @action log(string: string): void {
    console.log(string);
  }
  
<template>
  <FreestyleUsage @name="Dropdown">
    <:example>
      <BoxelDropdown>
        <:trigger>
          <BoxelButton>
            Trigger
          </BoxelButton>
        </:trigger>
        <:content as |dd|>
          <BoxelMenu
            @closeMenu={{dd.close}}
            @items={{array
              (menuItem
                "Duplicate" (fn this.log "Duplicate menu item clicked")
              )
              (menuItem "Share" (fn this.log "Share menu item clicked"))
            }}
          />
        </:content>
      </BoxelDropdown>

    </:example>
    <:api as |Args|>
      <Args.Yield
        @name="trigger"
        @description="Content to be used as trigger for basic dropdown"
      />
      <Args.Yield
        @name="content"
        @description="Content to show on dropdown. The provided block is rendered when trigger is triggered. Yields close action to close the dropdown"
      />
    </:api>
  </FreestyleUsage>
</template>
}