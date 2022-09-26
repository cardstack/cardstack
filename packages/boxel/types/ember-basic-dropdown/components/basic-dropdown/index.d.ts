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

export default class BasicDropdown extends Component<{
  Element: HTMLDivElement;
  Args: ArgsFromComponent<EmberBasicDropdown>;
  Blocks: {
    default: [
      {
        Trigger: ComponentLike<{
          Element: HTMLDivElement;
          Args: Partial<ArgsFromComponent<BasicDropdownTrigger>>;
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
