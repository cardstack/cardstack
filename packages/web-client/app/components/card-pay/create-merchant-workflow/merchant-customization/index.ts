import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import MerchantInfoService from '@cardstack/web-client/services/merchant-info';
import { inject as service } from '@ember/service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { didCancel, restartableTask, timeout } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { mostReadable, random as randomColor } from '@ctrl/tinycolor';
import config from '@cardstack/web-client/config/environment';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import * as Sentry from '@sentry/browser';

export default class CardPayCreateMerchantWorkflowMerchantCustomizationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @service declare merchantInfo: MerchantInfoService;

  @tracked merchantBgColor: string = randomColor().toHexString();
  @tracked merchantName: string = '';
  @tracked merchantId: string = '';
  @tracked lastCheckedMerchantId = '';
  @tracked merchantNameValidationMessage = '';
  @tracked merchantIdValidationMessage = '';
  @tracked merchantBgColorValidationMessage = '';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);

    let { merchantName, merchantId, merchantBgColor } =
      this.args.workflowSession.state;

    if (merchantName && merchantId && merchantBgColor) {
      this.merchantName = merchantName;
      this.merchantBgColor = merchantBgColor;
      this.merchantId = merchantId;
      this.validateMerchantId(); // this is necessary for enabling the CTA
    }
  }

  get canSaveDetails() {
    return this.allFieldsPopulated && this.noValidationErrors;
  }

  get allFieldsPopulated() {
    if (this.merchantBgColor && this.merchantName && this.merchantId) {
      return true;
    }
    return false;
  }

  get noValidationErrors() {
    return (
      this.merchantIdInputState === 'valid' &&
      !this.merchantNameValidationMessage &&
      !this.merchantBgColorValidationMessage
    );
  }

  get merchantIdInputState() {
    if (taskFor(this.validateMerchantIdTask).isRunning) {
      return 'loading';
    } else if (
      this.lastCheckedMerchantId === this.merchantId &&
      taskFor(this.validateMerchantIdTask).last?.value
    ) {
      return 'valid';
    } else if (this.merchantIdValidationMessage) {
      return 'invalid';
    } else {
      return 'initial';
    }
  }

  // We might want to do some whitespace collapsing before saving?
  get trimmedMerchantName() {
    return this.merchantName.trim();
  }

  get merchantTextColor() {
    return mostReadable(this.merchantBgColor, [
      '#ffffff',
      '#000000',
    ])!.toHexString();
  }

  @action onMerchantNameInput(value: string) {
    this.merchantName = value;
    this.validateMerchantName();
  }

  @action onMerchantIdInput(value: string) {
    this.merchantId = value;
    this.validateMerchantId();
  }

  @action onMerchantBgColorInput(event: InputEvent) {
    let value = (event.target as HTMLInputElement).value;
    this.merchantBgColor = value;
  }

  @action saveDetails() {
    let valuesToStore = {
      merchantName: this.trimmedMerchantName,
      merchantId: this.merchantId,
      merchantBgColor: this.merchantBgColor,
      merchantTextColor: this.merchantTextColor,
    };

    let merchantInfoHasBeenPersisted =
      this.args.workflowSession.state.merchantInfo;

    if (merchantInfoHasBeenPersisted) {
      let state = this.args.workflowSession.state;
      let detailsHaveChangedSincePersistence =
        state.merchantName !== valuesToStore.merchantName ||
        state.merchantId !== valuesToStore.merchantId ||
        state.merchantBgColor !== valuesToStore.merchantBgColor ||
        state.merchantTextColor !== valuesToStore.merchantTextColor;

      if (detailsHaveChangedSincePersistence) {
        this.args.workflowSession.delete('merchantInfo');
      }
    }

    this.args.workflowSession.updateMany(valuesToStore);
    this.args.onComplete?.();
  }

  @action validateMerchantName() {
    this.merchantNameValidationMessage = this.trimmedMerchantName
      ? ''
      : 'This field is required';
  }

  @action async validateMerchantId() {
    try {
      await taskFor(this.validateMerchantIdTask).perform();
    } catch (e) {
      if (didCancel(e)) {
        return;
      }
      console.error(e);
    }
  }

  @restartableTask *validateMerchantIdTask() {
    // debounce
    yield timeout(config.environment === 'test' ? 10 : 500);
    let value = this.merchantId;

    this.merchantIdValidationMessage = validateMerchantId(value);

    if (this.merchantIdValidationMessage) {
      return false;
    }

    try {
      let merchantSlugIsUnique: boolean = yield taskFor(
        this.merchantInfo.checkMerchantSlugUniquenessTask
      ).perform({ slug: value });

      this.lastCheckedMerchantId = value;
      if (!merchantSlugIsUnique) {
        this.merchantIdValidationMessage =
          'This Merchant ID is already taken. Please choose another one';
        return false;
      }

      this.merchantIdValidationMessage = '';
      return true;
    } catch (e) {
      console.log('Error validating uniqueness', e);
      Sentry.captureException(e);

      this.merchantIdValidationMessage =
        'There was an error validating merchant ID uniqueness';
      return false;
    }
  }
}
