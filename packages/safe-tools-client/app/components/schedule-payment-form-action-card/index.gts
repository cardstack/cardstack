import Component from '@glimmer/component';
import SchedulePaymentFormActionCardUI from './ui';
import { inject as service } from '@ember/service';
import NetworkService from '../../services/network';
import SafesService from '../../services/safes';
import ScheduledPaymentSdkService, { ConfiguredScheduledPaymentFees, ServiceGasEstimationResult } from '../../services/scheduled-payment-sdk';
import TokensService from '../../services/tokens';
import WalletService from '../../services/wallet';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { Day } from '@cardstack/boxel/components/boxel/input/date';
import { Time } from '@cardstack/boxel/components/boxel/input/time';
import SchedulePaymentFormValidator, { MaxGasFeeOption, ValidatableForm } from './validator';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';
import { TokenDetail, TransactionHash } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import { BigNumber, FixedNumber } from 'ethers';
import { task } from 'ember-concurrency-decorators';
import perform from 'ember-concurrency/helpers/perform';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import * as Sentry from '@sentry/browser';
import FeeCalculator, { type CurrentFees } from './fee-calculator';
import config from '@cardstack/safe-tools-client/config/environment';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import { addMonths, endOfDay, getDaysInMonth } from 'date-fns';

interface Signature {
  Element: HTMLElement;
}

interface ConfiguredFeesState {
  isLoading: boolean;
  value?: ConfiguredScheduledPaymentFees,
  error?: Error
}

interface ConfiguredUsdTokenState {
  isLoading: boolean;
  value?: TokenDetail,
  error?: Error
}

interface FeesState {
  isLoading: boolean;
  isIndeterminate: boolean;
  value?: CurrentFees,
  error?: Error
}

export interface MaxGasDescriptionsState {
  isLoading: boolean;
  isIndeterminate: boolean;
  value?: Record<MaxGasFeeOption, TokenQuantity>
  error?: Error
}

export interface RequiredGasTokenToSchedulePaymentState {
  isLoading: boolean;
  value?: TokenQuantity
  error?: Error
}

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

export default class SchedulePaymentFormActionCard extends Component<Signature> implements ValidatableForm {
  @service declare network: NetworkService;
  @service declare wallet: WalletService;
  @service declare safes: SafesService;
  @service declare tokens: TokensService;
  @service declare hubAuthentication: HubAuthenticationService;
  @service('token-to-usd') declare tokenToUsdService: TokenToUsdService;
  @service declare scheduledPaymentSdk: ScheduledPaymentSdkService;
  @service('scheduled-payments') declare scheduledPaymentsService: ScheduledPaymentsService;
  validator = new SchedulePaymentFormValidator(this);

  lastScheduledPaymentId?: string;

  @tracked schedulingStatus?: string;
  @tracked txHash?: TransactionHash;
  @tracked scheduleErrorMessage?: string;
  @tracked gasEstimation?: ServiceGasEstimationResult;

  updateInterval: ReturnType<typeof setInterval>;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    this.updateInterval = setInterval(() => {
      if (this.selectedGasToken) {
        taskFor(this.tokenToUsdService.updateUsdcRate).perform(this.selectedGasToken.address);
      }
    }, INTERVAL);
  }

  willDestroy() {
    clearInterval(this.updateInterval);
  }

  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  
  get minPaymentDate() {
    let now = new Date();
    return new Date(now.setHours(now.getHours(), now.getMinutes(), 0, 0));
  }

  get maxPaymentDate() {
    let now = new Date();
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }

  @tracked selectedPaymentType: 'one-time' | 'monthly' | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    if (paymentTypeId === 'one-time') {
      if (!this.paymentDate) {
        let now = new Date();
        this.paymentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12); // Tomorrow noon
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
    let selectedDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), this.minPaymentDate.getDate() < day.getDate() ? this.paymentDate?.getHours() : 0, this.minPaymentDate.getDate() < day.getDate() ? this.paymentDate?.getMinutes() : 0);
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

  //The minimum monthly until value is the first date of execution.
  get minMonthlyUntil() {
    let recurringStartMonth = new Date();
    if (this.paymentDayOfMonth && this.paymentDayOfMonth < recurringStartMonth.getDate()) {
      recurringStartMonth = addMonths(recurringStartMonth, 1);
    }
    let daysInRecurringStartMonth = getDaysInMonth(recurringStartMonth);
    let recurrsDay = Math.min(daysInRecurringStartMonth, this.paymentDayOfMonth ?? 1);

    return new Date(recurringStartMonth.getFullYear(), recurringStartMonth.getMonth(), recurrsDay);
  }

  get maxMonthlyUntil() {
    let now = new Date();
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }

  @tracked payeeAddress = '';
  @action onUpdatePayeeAddress(val: string) {
    this.payeeAddress = val;
  }

  @tracked privateMemo = '';
  @action onUpdatePrivateMemo(val: string) {
    this.privateMemo = val;
  }

  @tracked paymentAmountRaw: string = '';

  get paymentTokens(): TokenDetail[] {
    return this.tokens.transactionTokens;
  }
  @tracked _paymentToken: TokenDetail | undefined;
  get paymentToken(): TokenDetail | undefined {
    const { transactionTokens } = this.tokens;

    if (transactionTokens.find(gt => gt.address === this._paymentToken?.address)) {
      return this._paymentToken;
    }
    return undefined;
  }

  @action onUpdatePaymentAmount(val: string) {
    this.paymentAmountRaw = val;
  }
  @action onUpdatePaymentToken(val: TokenDetail) {
    this._paymentToken = val;
  }

  get paymentTokenQuantity() {
    const { paymentToken } = this;
    if (!paymentToken) {
      return undefined;
    }
    return TokenQuantity.fromInput(paymentToken, this.paymentAmountRaw);
  }

  @tracked _selectedGasToken: TokenDetail | undefined;
  
  @action onSelectGasToken(val: TokenDetail) {
    this._selectedGasToken = val;
  }

  get selectedGasToken(): TokenDetail | undefined {
    let { value: gasTokens } = this.tokens.gasTokens;

    if (gasTokens?.find(gt => gt.address === this._selectedGasToken?.address)) {
      return this._selectedGasToken;
    }
    return this.usdToken.value;
  }

  @tracked maxGasPrice: 'normal' | 'high' | 'max' = 'normal'

  @action onUpdateMaxGasPrice(val: 'normal' | 'high' | 'max') {
    this.maxGasPrice = val;
  }

  get isValid(): boolean {
    return (
      this.validator.isValid &&
      Boolean(this.safes.currentSafe) &&
      Boolean(this.gasEstimation) &&
      Number(this.gasEstimation?.gas) > 0 &&
      Boolean(this.usdcToGasTokenRate)
    );
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

  @use usdToken = resource(() => {
    const state: ConfiguredUsdTokenState = new TrackedObject({
      isLoading: true,
    });
    if (!this.wallet.isConnected) {
      return state;
    }
    (async () => {
      try {
        const usdToken = await this.scheduledPaymentSdk.getUsdToken();
        state.value = usdToken;
      } catch (error) {
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

  get usdcToGasTokenRate(): FixedNumber | undefined {
    if (!this.selectedGasToken) {
      return undefined;
    }
    return this.tokenToUsdService.getUsdcToTokenRate(this.selectedGasToken);
  }

  get fees() {
    const state: FeesState = new TrackedObject({
      isLoading: true,
      isIndeterminate: false
    });
    let isWalletConnected = this.wallet.isConnected;
    let { paymentTokenQuantity, selectedGasToken, configuredFees } = this
    if (!isWalletConnected || !paymentTokenQuantity || paymentTokenQuantity.count.isZero() || !selectedGasToken || !configuredFees.value) {
      state.isIndeterminate = true;
      return state;
    }
    if (configuredFees.value) {
      const feeCalculator = new FeeCalculator(
        configuredFees.value,
        paymentTokenQuantity,
        selectedGasToken,
        this.usdcToGasTokenRate
      );
      state.value = feeCalculator.calculateFee();  
    }
    return state;
  }

  @use maxGasDescriptions = resource(() => {
    const state: MaxGasDescriptionsState = new TrackedObject({
      isLoading: false,
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
        state.isLoading = true;
        this.gasEstimation = await this.scheduledPaymentSdk.getScheduledPaymentGasEstimation(scenario, paymentToken, selectedGasToken);
        const { gasRangeInGasTokenUnits } = this.gasEstimation;
        state.value = {
          normal: new TokenQuantity(selectedGasToken, gasRangeInGasTokenUnits.normal),
          high: new TokenQuantity(selectedGasToken, gasRangeInGasTokenUnits.high),
          max: new TokenQuantity(selectedGasToken, gasRangeInGasTokenUnits.max),
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

  @use requiredGasTokenToSchedulePayment = resource(() => {
    const state: RequiredGasTokenToSchedulePaymentState = new TrackedObject({
      isLoading: false,
    });
    
    let params = this.composeSchedulePaymentParams();
    if (!this.isValid || !params) {
      return state;
    }

    (async () => {
      try {
        state.isLoading = true;
        let amount = await this.scheduledPaymentSdk.estimateSchedulePaymentInGasToken(
          params.safeAddress,
          params.spModuleAddress,
          params.tokenAddress,
          params.amount,
          params.payeeAddress,
          params.executionGas,
          params.maxGasPrice,
          params.gasToken.address,
          params.salt,
          params.payAt,
          params.recurringDayOfMonth,
          params.recurringUntil
        );
        state.value = new TokenQuantity(params.gasToken, amount);
      } catch (error) {
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

  get isSufficientGasTokenBalance() {
    let gasTokenBalance = this.safes.tokenBalances?.find(t => t.tokenAddress?.toLowerCase() == this.selectedGasToken?.address?.toLowerCase());
    if (this.requiredGasTokenToSchedulePayment.value && this.selectedGasToken && this.selectedGasToken.address.toLowerCase() === this.requiredGasTokenToSchedulePayment.value.address.toLowerCase() && gasTokenBalance) {
      return gasTokenBalance.balance.gte(this.requiredGasTokenToSchedulePayment.value.count);
    }
    return false;
  }

  get gasEstimateInGasTokenUnits(): BigNumber {
    return this.gasEstimation?.gasRangeInGasTokenUnits.normal || BigNumber.from('0');
  }

  get gasEstimateTokenQuantity(): TokenQuantity|undefined {
    if (!this.selectedGasToken) {
      return undefined;
    }
    return new TokenQuantity(this.selectedGasToken, this.gasEstimateInGasTokenUnits);
  }

  @task *schedulePaymentTask() {
    let params = this.composeSchedulePaymentParams();
    let self = this;
    if (!this.isValid || !params) return;

    try {
      yield taskFor(this.scheduledPaymentSdk.schedulePayment).perform(
        params.safeAddress,
        params.spModuleAddress,
        params.tokenAddress,
        params.amount,
        params.payeeAddress,
        params.privateMemo,
        params.executionGas,
        params.maxGasPrice,
        params.gasToken.address,
        params.salt,
        params.payAt,
        params.recurringDayOfMonth,
        params.recurringUntil,
        this.hubAuthentication.authToken!,
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
      this.scheduledPaymentsService.reloadScheduledPayments();
      this.safes.reloadTokenBalances();
      this.isSuccessfullyScheduled = true;
    } catch(e) {
      this.schedulingStatus = undefined;

      const knownErrorPatterns: Record<string, string> = {
        'NotEnoughFundsForMultisigTx': 'Your safe does not have enough funds to pay for the transaction. Please add more funds to your safe and try again.',
      }

      let message = "An error occurred. Please reload the page and try again. If the problem persists, please contact support.";

      try {
        let parsed = JSON.parse(e.message);

        if (parsed.exception.includes('InsufficientFunds')) {
          // This means the relayer is out of funds and can't pay for the transaction
          Sentry.captureException(`Relayer is out of funds on ${this.network.chainId} network`);
          message = "We are currently experiencing a problem with our transaction relayer system. We are working on a fix. Please try again later. If the problem persists, please contact support."
        } else {
          let errorKey = Object.keys(knownErrorPatterns).find((key) => { return parsed.exception.includes(key) });
          if (errorKey) {
            message = knownErrorPatterns[errorKey];
          }
        }
      } catch (e) {
        // the message wasn't valid JSON
        Sentry.captureException(e.message);
      }

      this.scheduleErrorMessage = message;
    }

    Sentry.captureMessage(`Scheduled a payment with params: ${JSON.stringify(params)}`); // Useful for debugging purposes (for example, to see which params were used to calculate the spHash)
  }

  composeSchedulePaymentParams() {
    if (!this.paymentTokenQuantity || !this.selectedGasToken || !this.safes.currentSafe || !this.gasEstimation) return undefined;

    // Cost of the execution transaction in gas token units by max gas cost preference (standard, high, max)
    const gasRangeByMaxPrice = this.gasEstimation.gasRangeInGasTokenUnits[this.maxGasPrice];

    // To get the max gas price in smallest units, we divide the total gas cost by units of gas needed to execute the transaction
    // Since the amount of gas units (gasEstimation.gas) can be larger then the cost in gas units in smallest units (this can happen in case of tokens with
    // 6 decimal places such as USDC/USDT), the result of the BigNumber integer division will be 0. But we want to define at least 1 as the max gas price
    // in smallest units, because if we use 0, then the transaction will fail because the max gas price is too low.
    const maxGasPriceInGasToken = gasRangeByMaxPrice.div(this.gasEstimation.gas)
    const maxGasPriceString = (maxGasPriceInGasToken.eq(BigNumber.from(0)) ? BigNumber.from(1) : maxGasPriceInGasToken).toString();

    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const salt = btoa(String.fromCharCode.apply(null, array));

    this.scheduleErrorMessage = undefined;

    const { currentSafe } = this.safes;

    let payAt = this.selectedPaymentType === 'one-time' ? Math.round(this.paymentDate!.getTime() / 1000) : null;
    let recurringDayOfMonth = this.selectedPaymentType === 'monthly' ? this.paymentDayOfMonth! : null;
    let recurringUntil = this.selectedPaymentType === 'monthly' ? Math.round(endOfDay(this.monthlyUntil!).getTime() / 1000) : null;
    return {
      safeAddress: currentSafe.address,
      spModuleAddress: currentSafe.spModuleAddress,
      tokenAddress: this.paymentTokenQuantity.address,
      amount: this.paymentTokenQuantity.count,
      payeeAddress: this.payeeAddress,
      privateMemo: this.privateMemo,
      executionGas: Number(this.gasEstimation.gas),
      maxGasPrice: maxGasPriceString,
      gasToken: this.selectedGasToken,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil
    }
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
    return this.safes.safes == undefined || this.safes.safes?.length <= 0;
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
      @maxPaymentDate={{this.maxPaymentDate}}
      @minPaymentTime={{this.minPaymentTime}}
      @paymentDate={{this.paymentDate}}
      @onSetPaymentTime={{this.onSetPaymentTime}}
      @onSetPaymentDate={{this.onSetPaymentDate}}
      @paymentDayOfMonth={{this.paymentDayOfMonth}}
      @onSelectPaymentDayOfMonth={{this.onSelectPaymentDayOfMonth}}
      @minMonthlyUntil={{this.minMonthlyUntil}}
      @maxMonthlyUntil={{this.maxMonthlyUntil}}
      @monthlyUntil={{this.monthlyUntil}}
      @onSetMonthlyUntil={{this.onSetMonthlyUntil}}
      @payeeAddress={{this.payeeAddress}}
      @isPayeeAddressInvalid={{not this.validator.isPayeeAddressValid}}
      @payeeAddressErrorMessage={{this.validator.payeeAddressErrorMessage}}
      @onUpdatePayeeAddress={{this.onUpdatePayeeAddress}}
      @privateMemo={{this.privateMemo}}
      @onUpdatePrivateMemo={{this.onUpdatePrivateMemo}}
      @paymentAmountRaw={{this.paymentAmountRaw}}
      @onUpdatePaymentAmount={{this.onUpdatePaymentAmount}}
      @isPaymentAmountInvalid={{not this.validator.isAmountValid}}
      @paymentAmountErrorMessage={{this.validator.amountErrorMessage}}
      @paymentToken={{this.paymentToken}}
      @paymentTokenQuantity={{this.paymentTokenQuantity}}
      @paymentTokens={{this.paymentTokens}}
      @onUpdatePaymentToken={{this.onUpdatePaymentToken}}
      @selectedGasToken={{this.selectedGasToken}}
      @gasTokens={{this.tokens.gasTokens.value}}
      @onSelectGasToken={{this.onSelectGasToken}}
      @isGasTokenInvalid={{not this.validator.isGasTokenValid}}
      @gasTokenErrorMessage={{this.validator.gasTokenErrorMessage}}
      @maxGasPrice={{this.maxGasPrice}}
      @onUpdateMaxGasPrice={{this.onUpdateMaxGasPrice}}
      @isMaxGasPriceInvalid={{not this.validator.isMaxGasPriceValid}}
      @maxGasPriceErrorMessage={{this.validator.maxGasPriceErrorMessage}}
      @onSchedulePayment={{perform this.schedulePaymentTask}}
      @maxGasDescriptions={{this.maxGasDescriptions}}
      @gasEstimateTokenQuantity={{this.gasEstimateTokenQuantity}}
      @isValid={{and this.isValid (not this.maxGasDescriptions.isLoading)}}
      @schedulingStatus={{this.schedulingStatus}}
      @networkSymbol={{this.network.symbol}}
      @walletProviderId={{this.wallet.providerId}}
      @txHash={{this.txHash}}
      @isSuccessfullyScheduled={{this.isSuccessfullyScheduled}}
      @scheduleErrorMessage={{this.scheduleErrorMessage}}
      @onReset={{this.resetForm}}
      @configuredFees={{this.configuredFees.value}}
      @isSafesEmpty={{this.isSafesEmpty}}
      @currentFees={{this.fees.value}}
      @requiredGasTokenToSchedulePayment={{this.requiredGasTokenToSchedulePayment.value}}
      @isSufficientGasTokenBalance={{this.isSufficientGasTokenBalance}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard': typeof SchedulePaymentFormActionCard;
  }
}
