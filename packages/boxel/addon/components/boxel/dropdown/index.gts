import Component from '@glimmer/component';
//@ts-expect-error glint does not think hash is consume but it is
import { hash } from '@ember/helper';
import cn from '@cardstack/boxel/helpers/cn';

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
      <dd.Trigger ...attributes>
        {{yield to="trigger"}}
      </dd.Trigger>
      <dd.Content class={{cn "boxel-dropdown__content" @contentClass}}>
        {{yield (hash close=dd.actions.close) to="content"}}
      </dd.Content>
    </BasicDropdown>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Dropdown': typeof BoxelDropdown;
  }
}

export default BoxelDropdown;
