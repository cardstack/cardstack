import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { didCancel, restartableTask, timeout } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { mostReadable, random as randomColor } from '@ctrl/tinycolor';
import config from '@cardstack/web-client/config/environment';

export default class CardPayDepositWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @tracked merchantBgColor: string = randomColor().toHexString();
  @tracked merchantName: string = '';
  @tracked merchantId: string = '';
  @tracked lastCheckedMerchantId = '';
  @tracked merchantNameValidationMessage = '';
  @tracked merchantIdValidationMessage = '';
  @tracked merchantBgColorValidationMessage = '';

  get canSaveDetails() {
    return this.allFieldsPopulated && this.noValidationErrors;
  }

  get allFieldsPopulated() {
    return this.merchantBgColor && this.merchantName && this.merchantId;
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
    this.args.workflowSession.updateMany({
      merchantName: this.trimmedMerchantName,
      merchantId: this.merchantId,
      merchantBgColor: this.merchantBgColor,
      merchantTextColor: this.merchantTextColor,
    });
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

    if (value) {
      this.merchantIdValidationMessage = findDomainNameErrors(value);
    } else {
      this.merchantIdValidationMessage = 'This field is required';
    }

    if (this.merchantIdValidationMessage) {
      return false;
    }

    // replace w call to api
    let merchantIdExists: boolean = yield checkIfMerchantIdExists(value);

    this.lastCheckedMerchantId = value;
    if (merchantIdExists) {
      this.merchantIdValidationMessage =
        'This merchant ID is already taken, please choose another ID';
      return false;
    }

    this.merchantIdValidationMessage = '';
    return true;
  }
}

function findDomainNameErrors(value: string) {
  // international domain names start with xn--
  if (value.startsWith('xn--')) return 'Merchant ID cannot start with xn--';
  else if (/[^a-z0-9-]/.test(value))
    return 'Merchant ID can only contain lowercase alphabets, numbers, and hyphens';
  else if (/^[^a-zA-Z0-9]/.test(value) || /[^a-zA-Z0-9]$/.test(value))
    return 'Merchant ID must start and end with lowercase alphabet or number';
  else if (value.length > 50)
    return `Merchant ID must be at most 50 characters, currently ${value.length}`;
  return '';
}

async function checkIfMerchantIdExists(_value: string) {
  return false;
}
