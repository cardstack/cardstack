import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import {
  ColorCustomizationOption,
  PatternCustomizationOption,
  default as CardCustomizationService,
} from '@cardstack/web-client/services/card-customization';
import { reads } from 'macro-decorators';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

export default class LayoutCustomizationCard extends Component<WorkflowCardComponentArgs> {
  @service('card-customization')
  declare cardCustomizationService: CardCustomizationService;
  @reads('cardCustomizationService.colorSchemeOptions')
  declare colorSchemeOptions: ColorCustomizationOption[];
  @reads('cardCustomizationService.patternOptions')
  declare patternOptions: PatternCustomizationOption[];
  @tracked colorScheme: ColorCustomizationOption | undefined;
  @tracked pattern: PatternCustomizationOption | undefined;
  @tracked issuerName = '';
  @tracked nameFieldErrorMessage = '';
  @tracked isNameInvalid = false;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.cardCustomizationService
      .ensureCustomizationOptionsLoaded()
      .then(() => {
        this.colorScheme = this.colorSchemeOptions[0];
        this.pattern = this.patternOptions[0];
        let { workflowSession } = this.args;
        let colorScheme =
          workflowSession.getValue<ColorCustomizationOption>('colorScheme');
        let pattern =
          workflowSession.getValue<PatternCustomizationOption>('pattern');
        let issuerName = workflowSession.getValue<string>('issuerName');
        if (colorScheme && pattern) {
          this.colorScheme = colorScheme;
          this.pattern = pattern;
          this.issuerName = issuerName!;
        }
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

  @action updateColorScheme(item: any) {
    this.colorScheme = item;
  }
  @action updatePattern(item: any) {
    this.pattern = item;
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
    if (this.issuerName && this.colorScheme && this.pattern) {
      this.args.workflowSession.setValue({
        issuerName: this.issuerName,
        pattern: this.pattern,
        colorScheme: this.colorScheme,
      });
      this.args.onComplete?.();
    }
  }

  @action edit() {
    this.args.workflowSession.setValue({
      issuerName: '',
      pattern: null,
      colorScheme: null,
    });
    this.args.onIncomplete?.();
  }
}
