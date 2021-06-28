import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import {
  ColorCustomizationOption,
  PatternCustomizationOption,
  default as CardCustomizationOptionsService,
} from '@cardstack/web-client/services/card-customization-options';
import { reads } from 'macro-decorators';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

export default class LayoutCustomizationCard extends Component<WorkflowCardComponentArgs> {
  @service('card-customization-options')
  declare cardCustomizationOptionsService: CardCustomizationOptionsService;
  @reads('cardCustomizationOptionsService.colorOptions')
  declare colorOptions: ColorCustomizationOption[];
  @reads('cardCustomizationOptionsService.patternOptions')
  declare themeOptions: PatternCustomizationOption[];
  @tracked headerBackground: ColorCustomizationOption | undefined;
  @tracked headerTheme: PatternCustomizationOption | undefined;
  @tracked issuerName = '';
  @tracked nameFieldErrorMessage = '';
  @tracked isNameInvalid = false;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.cardCustomizationOptionsService
      .ensureCustomizationOptionsLoaded()
      .then(() => {
        this.headerBackground = this.colorOptions[0];
        this.headerTheme = this.themeOptions[0];
      });
  }

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
