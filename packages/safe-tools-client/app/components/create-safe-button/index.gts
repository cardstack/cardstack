import Component from '@glimmer/component';
import { on } from '@ember/modifier';
// import not from 'ember-truth-helpers/helpers/not';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
// import { inject as service} from '@ember/service';
import set from 'ember-set-helper/helpers/set';

import { type EmptyObject } from '@ember/component/helper';
import BoxelButton from '@cardstack/boxel/components/boxel/button';

// import WalletService from '@cardstack/safe-tools-client/services/wallet';
// import { svgJar } from '@cardstack/boxel/utils/svg-jar';
// import cssVar from '@cardstack/boxel/helpers/css-var';
// import BoxelModal from '@cardstack/boxel/components/boxel/modal';
// import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container'
import SetupSafeModal from '../setup-safe-modal';


interface Signature {
  Element: HTMLElement;
  Args: EmptyObject;
}

export default class CreateSafeButton extends Component<Signature> {
  @tracked isModalOpen = false;

  @action onClick() {
    this.isModalOpen = true
  }

  <template>
    <BoxelButton @kind='primary' {{on 'click' this.onClick}}>
      Create Safe
    </BoxelButton>

    <SetupSafeModal
      @isOpen={{this.isModalOpen}}
      @onClose={{set this 'isModalOpen' false}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CreateSafeButton': typeof CreateSafeButton;
  }
}
