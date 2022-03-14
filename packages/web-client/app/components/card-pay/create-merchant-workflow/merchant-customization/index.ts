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
import { isPresent } from '@ember/utils';

const randomColorOptions = config.environment === 'test' ? { seed: 1 } : {};

export default class CardPayCreateMerchantWorkflowMerchantCustomizationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @service declare merchantInfo: MerchantInfoService;

  @tracked merchantBgColor: string =
    randomColor(randomColorOptions).toHexString();
  @tracked merchantName: string = '';
  @tracked merchantId: string = '';
  @tracked lastCheckedMerchantId = '';
  @tracked merchantNameValidationMessage = '';
  @tracked merchantIdValidationMessage = '';
  @tracked merchantBgColorValidationMessage = '';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    let { workflowSession } = this.args;
    let merchantName = workflowSession.getValue<string>('merchantName');
    let merchantId = workflowSession.getValue<string>('merchantId');
    let merchantBgColor = workflowSession.getValue<string>('merchantBgColor');

    if (
      isPresent(merchantName) &&
      isPresent(merchantId) &&
      isPresent(merchantBgColor)
    ) {
      this.merchantName = merchantName!;
      this.merchantBgColor = merchantBgColor!;
      this.merchantId = merchantId!;
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
    let { workflowSession } = this.args;
    let merchantInfoHasBeenPersisted =
      !!workflowSession.getValue('merchantInfo');

    if (merchantInfoHasBeenPersisted) {
      let detailsHaveChangedSincePersistence =
        workflowSession.getValue('merchantName') !==
          valuesToStore.merchantName ||
        workflowSession.getValue('merchantId') !== valuesToStore.merchantId ||
        workflowSession.getValue('merchantBgColor') !==
          valuesToStore.merchantBgColor ||
        workflowSession.getValue('merchantTextColor') !==
          valuesToStore.merchantTextColor;

      if (detailsHaveChangedSincePersistence) {
        workflowSession.delete('merchantInfo');
      }
    }

    this.args.workflowSession.setValue(valuesToStore);
    this.args.onComplete?.();
  }

  @action validateMerchantName() {
    let message: string = '';
    if (!this.trimmedMerchantName.length) {
      message = 'This field is required';
    } else if (this.trimmedMerchantName.length > 50) {
      message = 'Cannot exceed 50 characters';
    }
    this.merchantNameValidationMessage = message;
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
      let { slugAvailable, detail } = yield taskFor(
        this.merchantInfo.checkMerchantSlugUniquenessTask
      ).perform({ slug: value });

      this.lastCheckedMerchantId = value;
      if (!slugAvailable) {
        this.merchantIdValidationMessage = detail;
        return false;
      }

      this.merchantIdValidationMessage = '';
      return true;
    } catch (e) {
      console.error('Error validating uniqueness', e);
      Sentry.captureException(e);

      this.merchantIdValidationMessage =
        'There was an error validating payment profile ID uniqueness';

      if (e.message.startsWith('No valid auth token')) {
        let { workflowSession } = this.args;
        workflowSession?.workflow?.cancel('UNAUTHENTICATED');
        throw new Error('UNAUTHENTICATED');
      }
      return false;
    }
  }
}
