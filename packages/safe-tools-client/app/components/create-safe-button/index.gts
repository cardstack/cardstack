import { BigNumber } from 'ethers';
import Web3 from 'web3';

import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { type EmptyObject } from '@ember/component/helper';
import { taskFor } from 'ember-concurrency-ts';
import { getCurrentGasPrice } from '@cardstack/cardpay-sdk';

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

  @tracked isLoadingGasInfo = false;
  @tracked hasEnoughBalance = false;
  @tracked gasCostDisplay =  `Couldn't estimate gas`


  @action async onClick() {
    this.isLoadingGasInfo = true;
    this.isModalOpen = true;

    try {
      const [gasEstimate, nativeTokenBalance] = await Promise.all([
        this.scheduledPaymentsSdk.getCreateSafeGasEstimation(),
        this.wallet.fetchNativeTokenBalance(),
      ]);

      const balance = BigNumber.from(nativeTokenBalance?.amount);

      this.hasEnoughBalance = !!gasEstimate?.lt(balance);

      const tokenSymbol = nativeTokenBalance?.symbol || '';
      const gasEstimateString = Web3.utils.fromWei(
        gasEstimate?.toString() || ''
      )

      this.gasCostDisplay = `${gasEstimateString} ${tokenSymbol}`

    } catch (e) {
      // TODO: handle error 
      console.log('gasEstimate', e);
    } finally {
      this.isLoadingGasInfo = false;
    }
  }

  @action closeModal() {
    this.isModalOpen = false
  }

  @action handleSafeCreation() {
    taskFor(this.scheduledPaymentsSdk.createSafe).perform()
    .then(async () => { 
      // Fetch from sdk or add task result manually ??
      await this.wallet.fetchSafes();
      this.closeModal();
    }).catch((e) => {
      //TODO: handle error case
      console.log('Error creating safe', e)
    })
  }

  get isProvisioning() { 
    return taskFor(this.scheduledPaymentsSdk.createSafe).isRunning
  }

  <template>
    <BoxelButton @kind='primary' {{on 'click' this.onClick}}>
      Create Safe
    </BoxelButton>

    <SetupSafeModal
      @isOpen={{this.isModalOpen}}
      @onClose={{this.closeModal}}
      @isLoadingGasInfo={{this.isLoadingGasInfo}}
      @isProvisioning={{this.isProvisioning}}
      @onProvisionClick={{this.handleSafeCreation}}
      @hasEnoughBalance={{this.hasEnoughBalance}}
      @gasCostDisplay={{this.gasCostDisplay}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CreateSafeButton: typeof CreateSafeButton;
  }
}
