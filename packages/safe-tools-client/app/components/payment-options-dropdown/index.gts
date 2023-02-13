import Component from '@glimmer/component';
import BoxelIconButton from '@cardstack/boxel/components/boxel/icon-button';
import ScheduledPaymentSdkService from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import { ScheduledPaymentBase } from '@cardstack/safe-tools-client/services/scheduled-payments';
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
import set from 'ember-set-helper/helpers/set';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import * as Sentry from '@sentry/browser';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    scheduledPayment: ScheduledPaymentBase;
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

  @action closeCancelScheduledPaymentModal(reload: boolean) {
    this.isCancelPaymentModalOpen = false;
    if (reload) this.scheduledPayments.reloadScheduledPayments();
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
              "Cancel Payment" (set this 'isCancelPaymentModalOpen' true)
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
        <Section @title="Cancel your scheduled payment">
          <div>
            <p>You're about to cancel your payment of <strong>{{@scheduledPayment.paymentTokenQuantity.displayable}}</strong>
            to <span class="blockchain-address">{{truncateMiddle @scheduledPayment.payeeAddress}}</span>, scheduled for <strong>{{formatDate @scheduledPayment.payAt "d/M/yyyy"}}</strong>.</p>

            <p>This action will remove the scheduled payment from the scheduled payment module, and it won't be attempted in the future.</p>
          </div>
        </Section>

        <ActionChin @state={{this.cancelPaymentState}}>
          <:default as |a|>
            {{#if this.cancelationErrorMessage}}
              <a.ActionButton {{on "click" this.cancelScheduledPayment}} data-test-cancel-payment-button>
                Cancel Payment
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
                Cancel Payment
              </a.ActionButton>
              <a.CancelButton {{on 'click' (fn this.closeCancelScheduledPaymentModal false)}} data-test-close-cancel-payment-modal>
                Close
              </a.CancelButton>
            {{/if}}
          </:default>
          <:inProgress as |i|>
            <i.ActionStatusArea>
              <BoxelLoadingIndicator class="schedule-payment-form-action-card__loading-indicator" @color="var(--boxel-light)" />

              Canceling scheduled payment...
            </i.ActionStatusArea>

            <i.InfoArea>
              <InfoIcon class='action-chin-info-icon' />
              Canceling a payment could take up to a couple of minutes, depending on the blockchain network conditions.
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
