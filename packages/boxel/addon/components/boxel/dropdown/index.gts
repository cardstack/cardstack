import Component from '@glimmer/component';
//@ts-expect-error glint does not think hash is consume but it is
import { hash } from '@ember/helper';
import cn from '@cardstack/boxel/helpers/cn';
import focusTrap from 'ember-focus-trap/modifiers/focus-trap';
import { modifier } from "ember-modifier";
import BasicDropdown from 'ember-basic-dropdown/components/basic-dropdown'

import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    contentClass?: string;
  };
  Blocks: {
    trigger: [];
    content: [{ close: () => void }];
  };
}

// Needs to be class, BasicDropdown doesn't work with const
class BoxelDropdown extends Component<Signature> {
  <template>
    <BasicDropdown as |dd|>
      <dd.Trigger
        ...attributes
        {{this.registerTriggerElement}}
      >
        {{yield to="trigger"}}
      </dd.Trigger>
      <dd.Content
        class={{cn "boxel-dropdown__content" @contentClass}}
        {{focusTrap
          isActive=dd.isOpen
          focusTrapOptions=(hash
            initialFocus=this.triggerElement
            onDeactivate=dd.actions.close
            allowOutsideClick=true
          )
        }}
      >
        {{yield (hash close=dd.actions.close) to="content"}}
      </dd.Content>
    </BasicDropdown>
  </template>

  triggerElement!: HTMLElement;
  registerTriggerElement = modifier(element => {
    this.triggerElement = element as HTMLElement;
  }, { eager: false });
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Dropdown': typeof BoxelDropdown;
  }
}

export default BoxelDropdown;
