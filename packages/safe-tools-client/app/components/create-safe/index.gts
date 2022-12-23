import { BigNumber } from 'ethers';
import Web3 from 'web3';

import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import SafesService from '@cardstack/safe-tools-client/services/safes';
import SchedulePaymentSDKService from '@cardstack/safe-tools-client/services/scheduled-payments-sdk';
import { Safe } from '@cardstack/safe-tools-client/services/safes';
import CreateSafeModal from '../create-safe-modal';

import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

interface Signature {
  Element: HTMLElement;
  Args: {
    currentSafe: Safe | undefined;
  }
}

export default class CreateSafeButton extends Component<Signature> {
  @service declare wallet: WalletService;
  @service declare network: NetworkService;
  @service declare safes: SafesService;
  @service declare scheduledPaymentsSdk: SchedulePaymentSDKService;

  @tracked isModalOpen = false;

  @tracked isLoadingGasInfo = false;
  @tracked hasEnoughBalance = false;
  @tracked gasCostDisplay =  '';
  @tracked safeCreated =  false;
  @tracked comparingBalanceToGasCostErrorMessage = '';

  @action async openCreateSafeModal() {
    this.comparingBalanceToGasCostErrorMessage = '';
    this.safeCreated =  false;
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
      this.comparingBalanceToGasCostErrorMessage = "There was an error comparing your wallet balance to the estimated gas cost. Please reload the page and try again. If the problem persists, please contact support.";
      console.log(e) // TODO: Sentry
    } finally {
      this.isLoadingGasInfo = false;
    }
  }

  @action closeModal() {
    this.isModalOpen = false
  }

  @task *createSafe(): TaskGenerator<{ safeAddress: string }> {
    return yield this.scheduledPaymentsSdk.createSafe();
  }

  @task *waitForSafeToBeIndexed(
    chainId: number,
    walletAddress: string,
    safeAddress: string
  ): TaskGenerator<void> {
    yield this.scheduledPaymentsSdk.waitForSafeToBeIndexed(chainId, walletAddress, safeAddress);
  }

  @action async handleSafeCreation() {
    if (!this.wallet.address) {
      return;
    }

    let safeAddress: string = '';


    try {
      ({ safeAddress } = await taskFor(this.createSafe).perform());
    } catch (e) {
      console.log(e) // TODO: Sentry
    }
    this.safeCreated = true;

    try {
      await taskFor(this.waitForSafeToBeIndexed).perform(this.network.networkInfo.chainId, this.wallet.address, safeAddress);
    } catch (e) {
      console.log(e) // TODO: Sentry
    }

    await this.safes.safesResource.load();
    let newSafe = this.safes.safes?.find((safe: Safe) => safe.address == safeAddress);

    // newSafe should always be defined if we got this far - this is to satisfy TS
    if (newSafe) {
      this.safes.onSelectSafe(newSafe);
    }
  }

  get isProvisioning() {
    return taskFor(this.createSafe).isRunning
  }

  get isIndexing() {
    return taskFor(this.waitForSafeToBeIndexed).isRunning
  }

  get provisioningError(): Error | undefined {
    return taskFor(this.createSafe).last?.error as Error
  }

  get indexingError(): Error | undefined {
    return taskFor(this.waitForSafeToBeIndexed).last?.error as Error
  }

  get provisioningOrIndexingErrorMessage(): string | undefined {
    if (this.provisioningError) {
      return "There was an error provisioning your safe. Please try again, or contact support if the problem persists.";
    }

    if (this.indexingError) {
      return "Your safe was created but we couldn't fetch its info. There could be a delay in our indexing backend. Please reload this page in a couple of minutes to see your safe. If it doesn't appear, please contact support.";
    }

    return undefined;
  }

  <template>
    {{#unless this.args.currentSafe}}
      <BoxelButton @kind='primary' {{on 'click' this.openCreateSafeModal}} data-test-create-safe-button>
        Create Safe
      </BoxelButton>
    {{/unless}}

    <CreateSafeModal
      @isOpen={{this.isModalOpen}}
      @onClose={{this.closeModal}}
      @isLoadingGasInfo={{this.isLoadingGasInfo}}
      @isProvisioning={{this.isProvisioning}}
      @isIndexing={{this.isIndexing}}
      @onProvisionClick={{this.handleSafeCreation}}
      @hasEnoughBalance={{this.hasEnoughBalance}}
      @gasCostDisplay={{this.gasCostDisplay}}
      @safeCreated={{this.safeCreated}}
      @provisioningOrIndexingErrorMessage={{this.provisioningOrIndexingErrorMessage}}
      @comparingBalanceToGasCostErrorMessage={{this.comparingBalanceToGasCostErrorMessage}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CreateSafeButton: typeof CreateSafeButton;
  }
}
