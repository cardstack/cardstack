import { BigNumber } from 'ethers';
import Web3 from 'web3';

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

  @tracked gasInfo = {
    isLoading: false,
    hasEnoughBalance:  false,
    costDisplay: `Couldn't estimate gas`
  }

  @action async onClick() {
    this.gasInfo.isLoading = true;
    this.isModalOpen = true;

    try {
      const [gasEstimate, nativeTokenBalance] = await Promise.all([
        this.scheduledPaymentsSdk.getCreateSafeGasEstimation(),
        this.wallet.fetchNativeTokenBalance(),
      ]);

      const balance = BigNumber.from(nativeTokenBalance?.amount);

      this.gasInfo.hasEnoughBalance = !!gasEstimate?.lt(balance);

      const tokenSymbol = nativeTokenBalance?.symbol || '';
      const gasEstimateString = Web3.utils.fromWei(
        gasEstimate?.toString() || ''
      )

      this.gasInfo.costDisplay = `${gasEstimateString} ${tokenSymbol}`

    } catch (e) {
      // TODO: handle error 
      console.log('gasEstimate', e);
    } finally {
      this.gasInfo.isLoading = false;
    }
  }

  @action async handleSafeCreation() {
    //TODO: implement safe creating and handle status
  }

  <template>
    <BoxelButton @kind='primary' {{on 'click' this.onClick}}>
      Create Safe
    </BoxelButton>

    <SetupSafeModal
      @isOpen={{this.isModalOpen}}
      @onClose={{set this 'isModalOpen' false}}
      @isLoadingGasInfo={{this.gasInfo.isLoading}}
      @provisioning={{false}}
      @onProvisionClick={{this.handleSafeCreation}}
      @hasEnoughBalance={{this.gasInfo.hasEnoughBalance}}
      @gasCostDisplay={{this.gasInfo.costDisplay}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CreateSafeButton: typeof CreateSafeButton;
  }
}
