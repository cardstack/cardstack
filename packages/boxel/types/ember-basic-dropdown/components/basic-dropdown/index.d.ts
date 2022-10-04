/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { ComponentLike } from '@glint/template';

import EmberBasicDropdown, {
  DropdownActions,
  Dropdown,
} from 'ember-basic-dropdown/addon/components/basic-dropdown';
import BasicDropdownTrigger from 'ember-basic-dropdown/addon/components/basic-dropdown-trigger';
import BasicDropdownContent from 'ember-basic-dropdown/addon/components/basic-dropdown-content';

import { ArgsFromComponent } from 'global';

export type BasicDropdownArgs = ArgsFromComponent<EmberBasicDropdown>;

export type BasicDropdownTriggerArgs = ArgsFromComponent<BasicDropdownTrigger>;

export default class BasicDropdown extends Component<{
  Element: HTMLDivElement;
  Args: BasicDropdownArgs;
  Blocks: {
    default: [
      {
        Trigger: ComponentLike<{
          Element: HTMLDivElement;
          Args: Partial<BasicDropdownTriggerArgs>;
          Blocks: { default: [] };
        }>;
        Content: ComponentLike<{
          Element: HTMLDivElement;
          Args: Partial<ArgsFromComponent<BasicDropdownContent>>;
          Blocks: { default: [] };
        }>;
        actions: DropdownActions;
        uniqueId: Dropdown['uniqueId'];
        disabled: Dropdown['disabled'];
        isOpen: Dropdown['isOpen'];
      }
    ];
  };
}> {}
