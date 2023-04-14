import Component from '@glimmer/component';
import BoxelIconButton from '@cardstack/boxel/components/boxel/icon-button';
import ScheduledPaymentSdkService from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import truncateMiddle from '@cardstack/safe-tools-client/helpers/truncate-middle';
import { inject as service } from '@ember/service';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { noop } from '@cardstack/safe-tools-client/helpers/noop';
import { taskFor } from 'ember-concurrency-ts';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import SafesService from '@cardstack/safe-tools-client/services/safes';
import SuccessIcon from '@cardstack/safe-tools-client/components/icons/success';
import FailureIcon from '@cardstack/safe-tools-client/components/icons/failure';
import InfoIcon from '@cardstack/safe-tools-client/components/icons/info';
import BoxelDropdown from '@cardstack/boxel/components/boxel/dropdown';
import BoxelMenu from '@cardstack/boxel/components/boxel/menu';
import { type ActionChinState } from '@cardstack/boxel/components/boxel/action-chin/state'
import menuItem from '@cardstack/boxel/helpers/menu-item'
import { array, fn } from '@ember/helper';
import not from 'ember-truth-helpers/helpers/not';
import set from 'ember-set-helper/helpers/set';
import eq from 'ember-truth-helpers/helpers/eq';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import * as Sentry from '@sentry/browser';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import BlockExplorerButton from '@cardstack/safe-tools-client/components/block-explorer-button';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';
import { capitalize } from '@ember/string';

interface Signature {
  Element: HTMLElement;
  Args: {
    scheduledPayment: ScheduledPayment;
    canCancel: boolean;
  }
}

export default class PaymentOptionsDropdown extends Component<Signature> {
  @service declare scheduledPaymentSdk: ScheduledPaymentSdkService;
  @service declare scheduledPayments: ScheduledPaymentsService;
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare safes: SafesService;
  @service declare tokens: TokensService;
  @tracked optionsMenuOpened = false;
  @tracked isCancelPaymentModalOpen = false;
  @tracked cancelationErrorMessage?: string;
  @service declare network: NetworkService;

  @action closeCancelScheduledPaymentModal(reload: boolean) {
    this.isCancelPaymentModalOpen = false;
    if (reload) this.scheduledPayments.reloadScheduledPayments();
  }

  // When the payment has a creationTransactionError, it means it was not registered on chain and it will never be attempted.
  // In this case, we offer the user to delete the payment, which is different from canceling, because canceling includes
  // removing it from the blockchain. Depending on the mode, we show different text and buttons. Regardless of the mode,
  // cancelScheduledPayment is called, which is a method in the SDK which will either cancel (remove from the blockchain + update the row in the crank),
  // or just delete the payment from the hub (no need to remove from the blockchain because it was never registered there)
  get mode(): 'delete' | 'cancel' {
    return this.args.scheduledPayment.creationTransactionError ? 'delete' : 'cancel';
  }

  get cancelPaymentState(): ActionChinState {
    if (taskFor(this.cancelScheduledPaymentTask).isRunning) {
      return 'in-progress';
    }

    return 'default';
  }

  @task *cancelScheduledPaymentTask(
    scheduledPaymentId: string,
    authToken: string
  ): TaskGenerator<void> {
    try {
      yield this.scheduledPaymentSdk.cancelScheduledPayment(scheduledPaymentId, authToken);
    } catch (e) {
      this.cancelationErrorMessage = "There was an error canceling your scheduled payment. Please try again, or contact support if the problem persists.";
      Sentry.captureException(e);
    }
  }

  @action async cancelScheduledPayment() {
    await taskFor(this.cancelScheduledPaymentTask).perform(this.args.scheduledPayment.id, this.hubAuthentication.authToken!)
    this.safes.reloadTokenBalances();
  }

  get paymentCanceled() {
    return taskFor(this.cancelScheduledPaymentTask).last?.isSuccessful;
  }

  get cancelationError(): Error | undefined {
    return taskFor(this.cancelScheduledPaymentTask).last?.error as Error
  }

  <template>
    <BoxelDropdown>
      <:trigger as |bindings|>
        <BoxelIconButton
          @icon="more-actions"
          @height="30px"
          {{bindings}}
          data-test-scheduled-payment-card-options-button
        />
      </:trigger>
      <:content as |dd|>
        <BoxelMenu
          @closeMenu={{dd.close}}
          @items={{array
            (menuItem
              (cn (capitalize this.mode) "Payment") (if this.args.canCancel (set this 'isCancelPaymentModalOpen' true) noop) disabled=(not this.args.canCancel)
            )
          }}
        />
      </:content>
    </BoxelDropdown>

    <BoxelModal
      @size='medium'
      @isOpen={{this.isCancelPaymentModalOpen}}
      @onClose={{noop}}
      class="cancel-scheduled-payment"
      data-test-cancel-scheduled-payment-modal
    >
      <BoxelActionContainer
        as |Section ActionChin|
      >
        {{#if (eq this.mode 'delete')}}
          <Section @title="Delete your scheduled payment">
            <div>
              <p>
                You're about to delete your payment of <strong>{{@scheduledPayment.paymentTokenQuantity.displayable}}</strong>
                to <span class="blockchain-address">{{truncateMiddle @scheduledPayment.payeeAddress}}</span>,
                scheduled for <strong>{{formatDate @scheduledPayment.payAt "d/M/yyyy"}}</strong>, which failed to be registered on the blockchain.
              </p>
              <p>
                For more details on why the on-chain registration failed, please check the transaction in the blockchain explorer.
              </p>

              <BlockExplorerButton
                @networkSymbol={{this.network.symbol}}
                @transactionHash={{this.args.scheduledPayment.creationTransactionHash}}
              />
            </div>
          </Section>
        {{else}}
          <Section @title="Cancel your scheduled payment">
            <div>
              <p>
                You're about to cancel your payment of <strong>{{@scheduledPayment.paymentTokenQuantity.displayable}}</strong>
                to <span class="blockchain-address">{{truncateMiddle @scheduledPayment.payeeAddress}}</span>,
                scheduled for <strong>{{formatDate @scheduledPayment.payAt "d/M/yyyy"}}</strong>.
              </p>

              <p>This action will remove the scheduled payment from the scheduled payment module, and it won't be attempted in the future.</p>
            </div>
          </Section>
        {{/if}}

        <ActionChin @state={{this.cancelPaymentState}}>
          <:default as |a|>
            {{#if this.cancelationErrorMessage}}
              <a.ActionButton {{on "click" this.cancelScheduledPayment}} data-test-cancel-payment-button>
                {{capitalize this.mode}} Payment
              </a.ActionButton>

              <a.CancelButton {{on 'click' (fn this.closeCancelScheduledPaymentModal false)}} data-test-close-cancel-payment-modal>
                Close
              </a.CancelButton>

              <a.InfoArea>
                <FailureIcon class='action-chin-info-icon' />
                <span>{{this.cancelationErrorMessage}}</span>
              </a.InfoArea>
            {{else if this.paymentCanceled}}
              <a.ActionButton {{on "click" (fn this.closeCancelScheduledPaymentModal true)}} data-test-close-cancel-payment-modal>
                Close
              </a.ActionButton>

              <a.InfoArea>
                <SuccessIcon class='action-chin-info-icon' />
                Your scheduled payment was canceled and removed successfully, and it won't be attempted in the future.
              </a.InfoArea>
            {{else}}
              <a.ActionButton {{on "click" this.cancelScheduledPayment}} data-test-cancel-payment-button>
                {{capitalize this.mode}} Payment
              </a.ActionButton>
              <a.CancelButton {{on 'click' (fn this.closeCancelScheduledPaymentModal false)}} data-test-close-cancel-payment-modal>
                Close
              </a.CancelButton>
            {{/if}}
          </:default>
          <:inProgress as |i|>
            <i.ActionStatusArea>
              <BoxelLoadingIndicator class="schedule-payment-form-action-card__loading-indicator" @color="var(--boxel-light)" />

              {{#if (eq this.mode 'cancel')}}
                Canceling scheduled payment...
              {{else}}
                Deleting scheduled payment...
              {{/if}}
            </i.ActionStatusArea>

            <i.InfoArea>
              <InfoIcon class='action-chin-info-icon' />

              {{#if (eq this.mode 'cancel')}}
                Canceling a payment could take up to a couple of minutes, depending on the blockchain network conditions.
              {{/if}}
            </i.InfoArea>
          </:inProgress>
        </ActionChin>
      </BoxelActionContainer>
    </BoxelModal>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'PaymentOptionsDropdown': typeof PaymentOptionsDropdown;
  }
}
