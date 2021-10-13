import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import config from '@cardstack/web-client/config/environment';
import { IWorkflowSession } from '@cardstack/web-client/models/workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import MerchantInfoService from '@cardstack/web-client/services/merchant-info';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';

import {
  race,
  rawTimeout,
  task,
  TaskGenerator,
  waitForProperty,
} from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import {
  MerchantSafe,
  PrepaidCardSafe,
  TransactionOptions,
} from '@cardstack/cardpay-sdk';
import BN from 'bn.js';

interface CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs {
  workflowSession: IWorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

interface DropdownOption {
  card: PrepaidCardSafe;
  disabled: boolean;
}

const A_WHILE = config.environment === 'test' ? 500 : 1000 * 10;

export default class CardPayCreateMerchantWorkflowPrepaidCardChoiceComponent extends Component<CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs> {
  @service declare merchantInfo: MerchantInfoService;
  @service declare layer2Network: Layer2Network;
  @reads('createTask.last.error') declare error: Error | undefined;
  get merchantRegistrationFee(): number {
    return this.args.workflowSession.getValue('merchantRegistrationFee')!;
  }

  @tracked chinInProgressMessage?: string;
  @tracked txnHash?: TransactionHash;
  @tracked createTaskRunningForAWhile = false;
  @tracked selectedPrepaidCardAddress: string = '';

  lastNonce?: string;

  constructor(
    owner: unknown,
    args: CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs
  ) {
    super(owner, args);
    let { workflowSession } = this.args;

    let txnHash = workflowSession.getValue<TransactionHash>('txnHash');
    let prepaidCardAddress =
      workflowSession.getValue<string>('prepaidCardAddress');

    if (txnHash) {
      this.txnHash = txnHash;
    }

    if (prepaidCardAddress) {
      this.selectedPrepaidCardAddress = prepaidCardAddress;
    } else {
      let availableCards = this.prepaidCards.filter(
        (c) => c.spendFaceValue >= this.merchantRegistrationFee
      );
      if (availableCards.length === 1) {
        this.selectedPrepaidCardAddress = availableCards[0].address;
      }
    }
  }

  @action checkForPendingTransaction() {
    let { workflowSession } = this.args;
    let txnHash = workflowSession.getValue('txnHash');
    let merchantSafe = workflowSession.getValue('merchantSafe');

    if (txnHash && !merchantSafe) {
      this.createMerchant();
    }
  }

  get prepaidCards() {
    return this.layer2Network.safes.value.filterBy(
      'type',
      'prepaid-card'
    ) as PrepaidCardSafe[];
  }

  get prepaidCardsForDropdown() {
    let cards: DropdownOption[] = [];
    let lowBalCards: DropdownOption[] = [];

    if (this.prepaidCards.length) {
      this.prepaidCards.forEach((c) => {
        let isLowBal = c.spendFaceValue < this.merchantRegistrationFee;
        let option: DropdownOption = {
          card: c,
          disabled: isLowBal,
        };
        if (isLowBal) {
          lowBalCards.push(option);
        } else {
          cards.push(option);
        }
      });
    }

    return [...cards, ...lowBalCards];
  }

  @action choosePrepaidCard(option: DropdownOption) {
    this.selectedPrepaidCardAddress = option.card.address;
  }

  @action createMerchant() {
    taskFor(this.createTask)
      .perform()
      .catch((e) => console.error(e));
  }

  @action cancel() {
    taskFor(this.createTask).cancelAll();
  }

  @task *createTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;

    try {
      this.chinInProgressMessage =
        'You will receive a confirmation request from the Card Wallet app in a few moments…';

      if (!workflowSession.getValue('prepaidCardAddress')) {
        workflowSession.setValue(
          'prepaidCardAddress',
          this.selectedPrepaidCardAddress
        );
      }

      if (!workflowSession.getValue('merchantInfo')) {
        let persistedMerchantInfo = yield taskFor(
          this.merchantInfo.persistMerchantInfoTask
        ).perform({
          name: workflowSession.getValue('merchantName')!,
          slug: workflowSession.getValue('merchantId')!,
          color: workflowSession.getValue('merchantBgColor')!,
          textColor: workflowSession.getValue('merchantTextColor')!,
        });

        workflowSession.setValue('merchantInfo', persistedMerchantInfo);
      }

      if (
        workflowSession.getValue('txnHash') &&
        !workflowSession.getValue('merchantSafe')
      ) {
        let txnHash = workflowSession.getValue<TransactionHash>('txnHash')!;
        this.chinInProgressMessage = 'Processing transaction…';

        const merchantSafe: MerchantSafe = yield taskFor(
          this.layer2Network.resumeRegisterMerchantTransactionTask
        ).perform(this.selectedPrepaidCardAddress, txnHash);

        workflowSession.setValue('merchantSafe', merchantSafe);
      } else {
        let options: TransactionOptions = {
          onTxnHash: (txnHash: TransactionHash) => {
            this.txnHash = txnHash;
            workflowSession.setValue('txnHash', txnHash);
            this.chinInProgressMessage = 'Processing transaction…';
          },
        };

        if (this.lastNonce) {
          options.nonce = new BN(this.lastNonce);
        } else {
          options.onNonce = (nonce: BN) => {
            this.lastNonce = nonce.toString();
          };
        }

        let registerMerchantTaskInstance = taskFor(
          this.layer2Network.registerMerchantTask
        ).perform(
          this.selectedPrepaidCardAddress,
          workflowSession.getValue<Record<string, string>>('merchantInfo')!.did,
          options
        );

        let merchantSafe = yield race([
          registerMerchantTaskInstance,
          taskFor(this.timerTask).perform(),
        ]);

        workflowSession.setValue('merchantSafe', merchantSafe);

        this.createTaskRunningForAWhile = false;
      }

      this.args.onComplete();
    } catch (e) {
      let insufficientFunds = e.message.startsWith(
        'Prepaid card does not have enough balance to register a merchant.'
      );
      let tookTooLong = e.message.startsWith(
        'Transaction took too long to complete'
      );
      let unauthenticated = e.message.startsWith('No valid auth token');
      if (unauthenticated) {
        workflowSession?.workflow?.cancel('UNAUTHENTICATED');
        throw new Error('UNAUTHENTICATED');
      } else if (insufficientFunds) {
        // This should only happen if the chosen prepaid card has been used
        // elsewhere as it should otherwise not be selectable.
        workflowSession?.workflow?.cancel('INSUFFICIENT_FUNDS');
        throw new Error('INSUFFICIENT_FUNDS');
      } else if (tookTooLong) {
        throw new Error('TIMEOUT');
      } else if (isLayer2UserRejectionError(e)) {
        throw new Error('USER_REJECTION');
      } else {
        throw e;
      }
    }
  }
  @task *timerTask(): TaskGenerator<void> {
    this.createTaskRunningForAWhile = false;
    yield rawTimeout(A_WHILE);
    this.createTaskRunningForAWhile = true;
    yield waitForProperty(this, 'createTaskRunningForAWhile', false);
  }

  get selectedPrepaidCard() {
    return this.layer2Network.safes.getByAddress(
      this.selectedPrepaidCardAddress
    );
  }

  get enableCancelation() {
    return (
      taskFor(this.createTask).isRunning &&
      this.createTaskRunningForAWhile &&
      !this.txnHash
    );
  }

  get creationState() {
    if (taskFor(this.createTask).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }

  get hasTriedCreatingMerchant() {
    return taskFor(this.createTask).performCount > 0;
  }

  get txViewerUrl() {
    return this.txnHash && this.layer2Network.blockExplorerUrl(this.txnHash);
  }
}
