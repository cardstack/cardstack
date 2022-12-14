import Component from '@glimmer/component';
//@ts-expect-error glint does not think hash is consume but it is
import { hash, modifier, concat } from '@ember/helper';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import focusTrap from 'ember-focus-trap/modifiers/focus-trap';
import { modifier as createModifier, FunctionBasedModifier } from "ember-modifier";
import BasicDropdown,{ Dropdown } from 'ember-basic-dropdown/components/basic-dropdown'
import { action } from '@ember/object';

import './index.css';

interface DropdownTriggerSignature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: {
    Named: {
      dropdown: Dropdown;
      eventType?: 'click' | 'mousedown';
      stopPropagation?: boolean;
      [named: string]: unknown;
    };
    Positional: unknown[];
  };
}

export type DropdownAPI = Dropdown;

interface Signature {
  Element: HTMLDivElement;
  Args: {
    contentClass?: string;
    registerAPI?: (publicAPI: Dropdown) => void
    onClose?: () => void
  };
  Blocks: {
    trigger: [FunctionBasedModifier<{
      // note: should only be used with Button, but HTMLAnchorElement is included so that the
      // trigger bindings can be applied to BoxelButton without glint error
      Element: HTMLButtonElement | HTMLAnchorElement;
      Args: {
        Named: EmptyObject;
        Positional: unknown[];
      };
    }>];
    content: [{ close: () => void }];
  };
}

// Needs to be class, BasicDropdown doesn't work with const
class BoxelDropdown extends Component<Signature> {
  @action registerAPI(publicAPI: DropdownAPI) {
    this.args.registerAPI?.(publicAPI);
  }

  <template>
    {{!--
      Note:
      ...attributes will only apply to BasicDropdown if @renderInPlace={{true}}
      because otherwise it does not render any HTML elements of its own, only its yielded content
    --}}
    <BasicDropdown
      @registerAPI={{this.registerAPI}}
      @onClose={{@onClose}}
      as |dd|
    >
      {{yield (modifier
        this.dropdownModifier
        dropdown=dd
        eventType="click"
        stopPropagation=false
      ) to="trigger"}}
      <dd.Content
        data-test-boxel-dropdown-content
        class={{cn "boxel-dropdown__content" @contentClass}}
        {{focusTrap
          isActive=dd.isOpen
          focusTrapOptions=(hash
            initialFocus=(concat "[aria-controls='ember-basic-dropdown-content-" dd.uniqueId "']")
            onDeactivate=dd.actions.close
            allowOutsideClick=true
          )
        }}
      >
        {{yield (hash close=dd.actions.close) to="content"}}
      </dd.Content>
    </BasicDropdown>
  </template>

  dropdownModifier = createModifier<DropdownTriggerSignature>(function(element, _positional, named){
    const { dropdown, eventType: desiredEventType, stopPropagation } = named;

    if (element.tagName.toUpperCase() !== 'BUTTON') {
      throw new Error('Only buttons should be used with the dropdown modifier');
    }

    function updateAria(){
      element.setAttribute('aria-expanded', dropdown.isOpen ? 'true' : 'false');
      element.setAttribute('aria-disabled', dropdown.disabled ? 'true' : 'false');
    }

    function handleMouseEvent(e: MouseEvent){
      if (typeof document === 'undefined') return;

      if (!dropdown || dropdown.disabled) return;

      const eventType = e.type;
      const notLeftClick = e.button !== 0;
      if (eventType !== desiredEventType || notLeftClick) return;

      if (stopPropagation) e.stopPropagation();

      dropdown.actions.toggle(e);
      updateAria();
    }

    function handleKeyDown(e: KeyboardEvent): void {
      const { disabled, actions } = dropdown;

      if (disabled) return;
      if (e.keyCode === 27) {
        actions.close(e);
      }
      updateAria();
    }

    element.addEventListener('click', handleMouseEvent);
    element.addEventListener('keydown', handleKeyDown);

    element.setAttribute('data-ebd-id', `${dropdown.uniqueId}-trigger`);
    element.setAttribute(
      'aria-owns',
      `ember-basic-dropdown-content-${dropdown.uniqueId}`
    );
    element.setAttribute(
      'aria-controls',
      `ember-basic-dropdown-content-${dropdown.uniqueId}`
    );
    updateAria();

    return function cleanup() {
      element.removeEventListener('click', handleMouseEvent);
      element.removeEventListener('keydown', handleKeyDown);
    }
  }, { eager: false });
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Dropdown': typeof BoxelDropdown;
  }
}

export default BoxelDropdown;
