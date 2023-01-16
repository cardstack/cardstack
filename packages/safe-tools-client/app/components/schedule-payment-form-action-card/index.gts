import Component from '@glimmer/component';
import SchedulePaymentFormActionCardUI from './ui';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { inject as service } from '@ember/service';
import NetworkService from '../../services/network';
import SafesService from '../../services/safes';
import ScheduledPaymentSdkService, { ConfiguredScheduledPaymentFees, GasEstimationResult } from '../../services/scheduled-payment-sdk';
import TokensService from '../../services/tokens';
import WalletService from '../../services/wallet';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { Day } from '@cardstack/boxel/components/boxel/input/date';
import { Time } from '@cardstack/boxel/components/boxel/input/time';
import withTokenIcons from '../../helpers/with-token-icons';
import SchedulePaymentFormValidator, { MaxGasFeeOption, ValidatableForm } from './validator';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';
import { fromWei } from 'web3-utils';
import not from 'ember-truth-helpers/helpers/not';
import { convertAmountToNativeDisplay, TransactionHash } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import { BigNumber } from 'ethers';
import { task } from 'ember-concurrency-decorators';
import perform from 'ember-concurrency/helpers/perform';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';

interface Signature {
  Element: HTMLElement;
}

interface ConfiguredFeesState {
  isLoading: boolean;
  value?: ConfiguredScheduledPaymentFees,
  error?: Error
}

interface MaxGasDescriptionsState {
  isLoading: boolean;
  isIndeterminate: boolean;
  value?: Record<MaxGasFeeOption, string>
  error?: Error
}

export default class SchedulePaymentFormActionCard extends Component<Signature> implements ValidatableForm {
  @service declare network: NetworkService;
  @service declare wallet: WalletService;
  @service declare safes: SafesService;
  @service declare tokens: TokensService;
  @service declare scheduledPaymentSdk: ScheduledPaymentSdkService;
  @service('scheduled-payments') declare scheduledPaymentsService: ScheduledPaymentsService;
  validator = new SchedulePaymentFormValidator(this);
  gasEstimation?: GasEstimationResult;
  lastScheduledPaymentId?: string;

  @tracked schedulingStatus?: string;
  @tracked txHash?: TransactionHash;

  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  
  get minPaymentDate() {
    let now = new Date();
    return new Date(now.setHours(now.getHours() + 1, 0, 0, 0));
  }

  @tracked selectedPaymentType: 'one-time' | 'monthly' | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    if (paymentTypeId === 'one-time') {
      if (!this.paymentDate) {
        this.paymentDate = this.minPaymentDate;
      }
      
      this.selectedPaymentType = paymentTypeId;
    }
    if (paymentTypeId === 'monthly') {
      if (!this.monthlyUntil) {
        let now = new Date();
        this.monthlyUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }
      if (!this.paymentDayOfMonth) {
        this.paymentDayOfMonth = 1;
      }
      this.selectedPaymentType = paymentTypeId;
    }
  }

  @tracked paymentDate: Date | undefined;
  @action onSetPaymentDate(day: Day) {
    let selectedDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), this.paymentDate?.getHours(), this.paymentDate?.getMinutes());
    if (selectedDate < this.minPaymentDate) {
      this.paymentDate = this.minPaymentDate;
    } else {
      this.paymentDate = selectedDate;
    }
  }

  @action onSetPaymentTime(time: Time) {
    this.paymentDate?.setHours(time.getHours(), time.getMinutes());
    this.paymentDate = new Date((time as Date).getTime()); // trigger reactivity
  }

  get minPaymentTime() {
    let minPaymentTime;
    if (this.paymentDate && this.paymentDate.getDate() > this.minPaymentDate.getDate()) {
      minPaymentTime = new Date(this.minPaymentDate.getFullYear(), this.minPaymentDate.getMonth(), this.minPaymentDate.getDate(), 0, 0, 0, 0)
    } else {
      minPaymentTime = this.minPaymentDate;
    }
    return minPaymentTime;
  }
  
  @tracked monthlyUntil: Date | undefined;
  @action onSetMonthlyUntil(date: Date) {
    this.monthlyUntil?.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()); 
    if (this.monthlyUntil) {
      this.monthlyUntil = new Date(this.monthlyUntil?.getTime()); // trigger reactivity
    }
  }

  @tracked paymentDayOfMonth: number | undefined;
  @action onSelectPaymentDayOfMonth(val: number) {
    this.paymentDayOfMonth = val;

    if (this.monthlyUntil && this.monthlyUntil < this.minMonthlyUntil) {
      this.monthlyUntil = this.minMonthlyUntil;
    }
  }

  get minMonthlyUntil() {
    let minMonthlyUntil;
    let now = new Date();

    if (this.paymentDayOfMonth && this.paymentDayOfMonth < now.getDate()) {
      minMonthlyUntil = new Date(now.getFullYear(), now.getMonth() + 1, this.paymentDayOfMonth);
    } else {
      minMonthlyUntil = now;
    }

    return minMonthlyUntil;
  }

  @tracked payeeAddress = '';
  @action onUpdatePayeeAddress(val: string) {
    this.payeeAddress = val;
  }

  @tracked paymentAmountRaw: string = '';

  get paymentTokens(): SelectableToken[] {
    return this.tokens.transactionTokens;
  }
  @tracked _paymentToken: SelectableToken | undefined;
  get paymentToken(): SelectableToken | undefined {
    const { transactionTokens } = this.tokens;

    if (transactionTokens.find(gt => gt.address === this._paymentToken?.address)) {
      return this._paymentToken;
    }
    return undefined;
  }

  @action onUpdatePaymentAmount(val: string) {
    this.paymentAmountRaw = val;
  }
  @action onUpdatePaymentToken(val: SelectableToken) {
    this._paymentToken = val;
  }

  get paymentAmountTokenQuantity() {
    const { paymentToken } = this;
    if (!paymentToken) {
      return undefined;
    }
    return TokenQuantity.fromInput(paymentToken, this.paymentAmountRaw);
  }

  @tracked _selectedGasToken: SelectableToken | undefined;
  
  @action onSelectGasToken(val: SelectableToken) {
    this._selectedGasToken = val;
  }

  get selectedGasToken(): SelectableToken | undefined {
    let { value: gasTokens, isLoading } = this.tokens.gasTokens;

    if (isLoading || gasTokens?.find(gt => gt.address === this._selectedGasToken?.address)) {
      return this._selectedGasToken;
    }
    return undefined;
  }

  @tracked maxGasPrice: 'normal' | 'high' | 'max' | undefined;
  @action onUpdateMaxGasPrice(val: 'normal' | 'high' | 'max') {
    this.maxGasPrice = val;
  }

  get isValid(): boolean {
    return this.validator.isValid;
  }

  @use configuredFees = resource(() => {
    const state: ConfiguredFeesState = new TrackedObject({
      isLoading: true,
    });
    let isWalletConnected = this.wallet.isConnected;
    if (!isWalletConnected) {
      return state;
    }
    (async () => {
      try {
        const configuredFees = await this.scheduledPaymentSdk.getFees();
        state.value = configuredFees;
      } catch (error) {
        console.error(error);
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

  @use maxGasDescriptions = resource(() => {
    const state: MaxGasDescriptionsState = new TrackedObject({
      isLoading: true,
      isIndeterminate: false
    });
    let { selectedGasToken, selectedPaymentType, paymentToken } = this;
    let isWalletConnected = this.wallet.isConnected;
    if (!isWalletConnected) {
      state.isIndeterminate = true;
      return state;
    }
    if (!selectedGasToken) {
      state.isIndeterminate = true;
      return state;
    }
    if (!paymentToken?.address) {
      state.isIndeterminate = true;
      return state;
    }
    if (!selectedPaymentType) {
      state.isIndeterminate = true;
      return state;
    }
    // because networkInfo is tracked, anytime the network switches,
    // this resource will re-run
    const scenario = this.selectedPaymentType === 'one-time' ? 'execute_one_time_payment' : 'execute_recurring_payment';
    (async () => {
      try {
        this.gasEstimation = await this.scheduledPaymentSdk.getScheduledPaymentGasEstimation(scenario, paymentToken.address, selectedGasToken.address);
        const { gasRangeInGasTokenWei, gasRangeInUSD } = this.gasEstimation;
        state.value = {
          normal: `Less than ${fromWei(gasRangeInGasTokenWei.normal.toString(), 'ether')} ${selectedGasToken.symbol} (~${convertAmountToNativeDisplay(fromWei(gasRangeInUSD.normal.toString(), 'ether'), 'USD')})`,
          high: `Less than ${fromWei(gasRangeInGasTokenWei.high.toString(), 'ether')} ${selectedGasToken.symbol} (~${convertAmountToNativeDisplay(fromWei(gasRangeInUSD.high.toString(), 'ether'), 'USD')})`,
          max: `Capped at ${fromWei(gasRangeInGasTokenWei.max.toString(), 'ether')} ${selectedGasToken.symbol} (~${convertAmountToNativeDisplay(fromWei(gasRangeInUSD.max.toString(), 'ether'), 'USD')})`,
        };
      } catch (error) {
        console.error(error);
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

  @task *schedulePaymentTask() {
    let { currentSafe } = this.safes;
    if (!currentSafe) return;
    if (!this.validator.isValid) return;

    // Redundant to validation check but including it to narrow types for Typescript
    if (!this.paymentAmountTokenQuantity || !this.selectedGasToken || !this.gasEstimation) return;

    if (Number(this.gasEstimation.gas) <= 0) return;
    const { gasRangeInGasTokenWei } = this.gasEstimation;
    if (Object.keys(gasRangeInGasTokenWei).length <= 0) return;

    let maxGasPrice;
    switch(this.maxGasPrice) {
      case "normal":
        maxGasPrice = gasRangeInGasTokenWei.normal.div(this.gasEstimation.gas);
        break;
      case "high":
        maxGasPrice = gasRangeInGasTokenWei.high.div(this.gasEstimation.gas);
        break;
      case "max":
        maxGasPrice = gasRangeInGasTokenWei.max.div(this.gasEstimation.gas);
        break;
      default:
        maxGasPrice = BigNumber.from(0);
    }

    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const salt = btoa(String.fromCharCode.apply(null, array));
    const self = this;

    const {paymentAmountTokenQuantity} = this;
    yield taskFor(this.scheduledPaymentSdk.schedulePayment).perform(
      currentSafe.address,
      currentSafe.spModuleAddress,
      paymentAmountTokenQuantity.address,
      paymentAmountTokenQuantity.count,
      this.payeeAddress,
      Number(this.gasEstimation.gas),
      String(maxGasPrice),
      this.selectedGasToken.address,
      salt,
      this.selectedPaymentType === 'one-time' ? Math.round(this.paymentDate!.getTime() / 1000) : null,
      this.selectedPaymentType === 'monthly' ? this.paymentDayOfMonth! : null,
      this.selectedPaymentType === 'monthly' ? Math.round(this.monthlyUntil!.getTime() / 1000) : null,
      {
        onScheduledPaymentIdReady(scheduledPaymentId: string) {
          self.lastScheduledPaymentId = scheduledPaymentId;
        },
        onTxHash(txHash: TransactionHash) {
          self.txHash = txHash;
        },
        onBeginHubAuthentication() {
          self.schedulingStatus = "Authenticating..."
        },
        onBeginSpHashCreation() {
          self.schedulingStatus = "Calculating payment hash..."
        },
        onBeginRegisterPaymentWithHub() {
          self.schedulingStatus = "Registering payment with hub..."
        },
        onBeginPrepareScheduledPayment() {
          self.schedulingStatus = "Preparing transaction..."
        },
        onBeginSchedulingPaymentOnChain() {
          self.schedulingStatus = "Scheduling on-chain..."
        },
        onBeginUpdatingHubWithTxHash() {
          self.schedulingStatus = "Recording on hub..."
        },
        onBeginWaitingForTransactionConfirmation() {
          self.schedulingStatus = "Confirming transaction..."
        }
      }
    )

    this.isSuccessfullyScheduled = true;
    this.scheduledPaymentsService.reloadScheduledPayments();
  }

  @action resetForm() {
    this.isSuccessfullyScheduled = false;
    this.schedulingStatus = undefined;
    this.txHash = undefined;
  }

  get isScheduling() {
    return taskFor(this.schedulePaymentTask).isRunning;
  }

  get isSafesEmpty() {
    return this.safes.safes || this.safes.safes?.length <= 0
  }

  @tracked isSuccessfullyScheduled = false;

  <template>
    <SchedulePaymentFormActionCardUI
      @paymentTypeOptions={{this.paymentTypeOptions}}
      @selectedPaymentType={{this.selectedPaymentType}}
      @onSelectPaymentType={{this.onSelectPaymentType}}
      @isPaymentTypeInvalid={{not this.validator.isPaymentTypeValid}}
      @paymentTypeErrorMessage={{this.validator.paymentTypeErrorMessage}}
      @minPaymentDate={{this.minPaymentDate}}
      @minPaymentTime={{this.minPaymentTime}}
      @paymentDate={{this.paymentDate}}
      @onSetPaymentTime={{this.onSetPaymentTime}}
      @onSetPaymentDate={{this.onSetPaymentDate}}
      @paymentDayOfMonth={{this.paymentDayOfMonth}}
      @onSelectPaymentDayOfMonth={{this.onSelectPaymentDayOfMonth}}
      @minMonthlyUntil={{this.minMonthlyUntil}}
      @monthlyUntil={{this.monthlyUntil}}
      @onSetMonthlyUntil={{this.onSetMonthlyUntil}}
      @payeeAddress={{this.payeeAddress}}
      @isPayeeAddressInvalid={{not this.validator.isPayeeAddressValid}}
      @payeeAddressErrorMessage={{this.validator.payeeAddressErrorMessage}}
      @onUpdatePayeeAddress={{this.onUpdatePayeeAddress}}
      @paymentAmountRaw={{this.paymentAmountRaw}}
      @onUpdatePaymentAmount={{this.onUpdatePaymentAmount}}
      @isPaymentAmountInvalid={{not this.validator.isAmountValid}}
      @paymentAmountErrorMessage={{this.validator.amountErrorMessage}}
      @paymentToken={{this.paymentToken}}
      @paymentTokens={{this.paymentTokens}}
      @onUpdatePaymentToken={{this.onUpdatePaymentToken}}
      @selectedGasToken={{this.selectedGasToken}}
      @gasTokens={{withTokenIcons this.tokens.gasTokens.value}}
      @onSelectGasToken={{this.onSelectGasToken}}
      @isGasTokenInvalid={{not this.validator.isGasTokenValid}}
      @gasTokenErrorMessage={{this.validator.gasTokenErrorMessage}}
      @maxGasPrice={{this.maxGasPrice}}
      @onUpdateMaxGasPrice={{this.onUpdateMaxGasPrice}}
      @isMaxGasPriceInvalid={{not this.validator.isMaxGasPriceValid}}
      @maxGasPriceErrorMessage={{this.validator.maxGasPriceErrorMessage}}
      @onSchedulePayment={{perform this.schedulePaymentTask}}
      @maxGasDescriptions={{this.maxGasDescriptions.value}}
      @isSubmitEnabled={{this.isValid}}
      @schedulingStatus={{this.schedulingStatus}}
      @networkSymbol={{this.network.symbol}}
      @walletProviderId={{this.wallet.providerId}}
      @txHash={{this.txHash}}
      @isSuccessfullyScheduled={{this.isSuccessfullyScheduled}}
      @onReset={{this.resetForm}}
      @configuredFees={{this.configuredFees.value}}
      @isSafesEmpty={{this.isSafesEmpty}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard': typeof SchedulePaymentFormActionCard;
  }
}
