import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import {
  colorOptions,
  patternOptions,
} from '@cardstack/web-client/utils/prepaid-card-customization-options';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
interface LayoutCustomizationCardArgs {
  workflowSession: WorkflowSession;
  isComplete: boolean;
  onComplete: () => void;
  onIncomplete: () => void;
}

export default class LayoutCustomizationCard extends Component<LayoutCustomizationCardArgs> {
  colorOptions = colorOptions;
  themeOptions = patternOptions;
  @tracked headerBackground = this.colorOptions[0];
  @tracked headerTheme = this.themeOptions[0];
  @tracked issuerName = '';
  @tracked nameFieldErrorMessage = '';
  @tracked isNameInvalid = false;

  get ctaState() {
    if (this.args.isComplete) {
      return 'memorialized';
    }

    return 'default';
  }

  get ctaDisabled() {
    return !this.issuerName;
  }

  @action updateHeaderBackground(item: any) {
    this.headerBackground = item;
  }
  @action updateHeaderTheme(item: any) {
    this.headerTheme = item;
  }

  @action onNameInput(value: string): void {
    this.validateName(value);
    if (this.isNameInvalid) {
      this.issuerName = '';
      return;
    }
    this.issuerName = value;
  }

  @action validateName(value: string): void {
    if (!value) {
      this.isNameInvalid = true;
      this.nameFieldErrorMessage = 'This is a required field';
      return;
    }
    this.isNameInvalid = false;
    this.nameFieldErrorMessage = '';
  }

  @action save() {
    if (this.issuerName && this.headerBackground && this.headerTheme) {
      this.args.workflowSession.updateMany({
        issuerName: this.issuerName,
        headerTheme: this.headerTheme,
        headerBackground: this.headerBackground,
      });
      this.args.onComplete?.();
    }
  }

  @action edit() {
    this.args.workflowSession.updateMany({
      issuerName: '',
      headerTheme: '',
      headerBackground: '',
    });
    this.args.onIncomplete?.();
  }
}
