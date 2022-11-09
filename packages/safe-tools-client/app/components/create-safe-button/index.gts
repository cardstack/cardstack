import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import set from 'ember-set-helper/helpers/set';
import { type EmptyObject } from '@ember/component/helper';

import BoxelButton from '@cardstack/boxel/components/boxel/button';

import WalletService from '@cardstack/safe-tools-client/services/wallet';
import SchedulePaymentSDKService from '@cardstack/safe-tools-client/services/scheduled-payments-sdk';
import SetupSafeModal from '../setup-safe-modal';

interface Signature {
  Element: HTMLElement;
  Args: EmptyObject;
}

export default class CreateSafeButton extends Component<Signature> {
  @service declare wallet: WalletService;
  @service declare scheduledPaymentsSdk: SchedulePaymentSDKService;

  @tracked isModalOpen = false;

  @action async onClick() {
    this.isModalOpen = true;
    this.wallet.fetchNativeTokenBalance();
    try {
      await this.scheduledPaymentsSdk.getCreateSafeGasEstimation();
    } catch (e) {
      console.log('gasEstimationFailed', e);
    }
    try {
      // await this.scheduledPaymentsSdk.createSafe();
    } catch (e) {
      console.log('createSafeFailed', e);
    }
  }

  <template>
    <BoxelButton @kind='primary' {{on 'click' this.onClick}}>
      Create Safe
    </BoxelButton>
        {{this.wallet.nativeTokenBalance.amount}}{{this.wallet.nativeTokenBalance.symbol}}
        {{this.scheduledPaymentsSdk.estimatedSafeCreationGas}}
    // Make modal dumb, add spinner on modal
    <SetupSafeModal
      @isOpen={{this.isModalOpen}}
      @onClose={{set this 'isModalOpen' false}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CreateSafeButton: typeof CreateSafeButton;
  }
}
