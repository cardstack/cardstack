import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import config from '@cardstack/web-client/config/environment';
import { IWorkflowSession } from '@cardstack/web-client/models/workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import ProfileService from '@cardstack/web-client/services/profile';
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

interface CardPayCreateProfileWorkflowPrepaidCardChoiceComponentArgs {
  workflowSession: IWorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

interface DropdownOption {
  id: string;
  card: PrepaidCardSafe;
  disabled: boolean;
}

const A_WHILE = config.environment === 'test' ? 500 : 1000 * 10;

export default class CardPayCreateProfileWorkflowPrepaidCardChoiceComponent extends Component<CardPayCreateProfileWorkflowPrepaidCardChoiceComponentArgs> {
  @service declare profile: ProfileService;
  @service declare layer2Network: Layer2Network;
  @reads('createTask.last.error') declare error: Error | undefined;
  get profileRegistrationFee(): number {
    return this.args.workflowSession.getValue('profileRegistrationFee')!;
  }

  @tracked chinInProgressMessage?: string;
  @tracked txnHash?: TransactionHash;
  @tracked createTaskRunningForAWhile = false;
  @tracked selectedPrepaidCardAddress: string = '';

  lastNonce?: string;

  constructor(
    owner: unknown,
    args: CardPayCreateProfileWorkflowPrepaidCardChoiceComponentArgs
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
        (c) => c.spendFaceValue >= this.profileRegistrationFee
      );
      if (availableCards.length === 1) {
        this.selectedPrepaidCardAddress = availableCards[0].address;
      }
    }
  }

  @action checkForPendingTransaction() {
    let { workflowSession } = this.args;
    let txnHash = workflowSession.getValue('txnHash');
    let profileSafe = workflowSession.getValue('profileSafe');

    if (txnHash && !profileSafe) {
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
        let isLowBal = c.spendFaceValue < this.profileRegistrationFee;
        let option: DropdownOption = {
          id: c.address,
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
        'You will receive a confirmation request from the Cardstack Wallet app in a few moments…';

      if (!workflowSession.getValue('prepaidCardAddress')) {
        workflowSession.setValue(
          'prepaidCardAddress',
          this.selectedPrepaidCardAddress
        );
      }

      if (!workflowSession.getValue('profile')) {
        let persistedProfile = yield taskFor(
          this.profile.persistProfileInfoTask
        ).perform({
          name: workflowSession.getValue('profileName')!,
          slug: workflowSession.getValue('profileSlug')!,
          color: workflowSession.getValue('profileBgColor')!,
          textColor: workflowSession.getValue('profileTextColor')!,
        });

        workflowSession.setValue('profile', persistedProfile);
      }

      if (
        workflowSession.getValue('txnHash') &&
        !workflowSession.getValue('profileSafe')
      ) {
        let txnHash = workflowSession.getValue<TransactionHash>('txnHash')!;
        this.chinInProgressMessage = 'Processing transaction…';

        const profileSafe: MerchantSafe = yield taskFor(
          this.layer2Network.resumeRegisterProfileTransactionTask
        ).perform(this.selectedPrepaidCardAddress, txnHash);

        workflowSession.setValue('profileSafe', profileSafe);
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

        let registerProfileTaskInstance = taskFor(
          this.layer2Network.registerProfileTask
        ).perform(
          this.selectedPrepaidCardAddress,
          workflowSession.getValue<Record<string, string>>('profile')!.did,
          options
        );

        let profileSafe = yield race([
          registerProfileTaskInstance,
          taskFor(this.timerTask).perform(),
        ]);

        workflowSession.setValue('profileSafe', profileSafe);

        this.createTaskRunningForAWhile = false;
      }

      this.args.onComplete();
    } catch (e) {
      workflowSession.delete('txnHash');
      let insufficientFunds = e.message.startsWith(
        'Prepaid card does not have enough balance to register a profile.'
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
