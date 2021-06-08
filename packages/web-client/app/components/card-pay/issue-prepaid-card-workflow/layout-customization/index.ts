import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import MockTheme1 from '@cardstack/web-client/images/backgrounds/mock-theme-1.svg';
import MockTheme2 from '@cardstack/web-client/images/backgrounds/mock-theme-2.svg';
import BB from '@cardstack/web-client/images/backgrounds/bridge-background.svg';
import blankChoicePlaceholder from '@cardstack/web-client/images/backgrounds/background-selection-placeholder.svg';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
interface LayoutCustomizationCardArgs {
  workflowSession: WorkflowSession;
  isComplete: boolean;
  onComplete: () => void;
  onIncomplete: () => void;
}

// data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw== is a blank image
// see https://stackoverflow.com/questions/9126105/blank-image-encoded-as-data-uri
let blankImage =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export default class LayoutCustomizationCard extends Component<LayoutCustomizationCardArgs> {
  colorOptions = [
    '#00ebe5',
    '#37eb77',
    '#ac00ff',
    '#efefef',
    '#393642',
    '#c3fc33',
    // gradients generated in https://codepen.io/aierie/pen/qBryBoy?editors=0010
    // the codepen assumes that you are only generating gradients with two colors and is hardcoded
    // if gradient style changes, this should be modified to make sure that angle and starting point is correct
    // to use this, copy the svg code for a swatch's gradient and paste it in the codepen's input
    'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
    'linear-gradient(139.27deg, #03c4bf 16%, #ac00ff 100%)',
    'linear-gradient(139.27deg, #c3fc33 16%, #0069f9 100%)',
    'linear-gradient(139.27deg, #ac00ff 16%, #ffd800 100%)',
    'transparent',
  ].map((color) =>
    color === 'transparent'
      ? { image: blankChoicePlaceholder, background: null, id: color }
      : { image: null, background: color, id: color }
  );
  themeOptions = [MockTheme1, MockTheme2, BB, blankImage].map((url) =>
    url === blankImage
      ? {
          image: blankChoicePlaceholder,
          background: null,
          id: url,
        }
      : {
          image: url,
          background: 'black',
          id: url,
        }
  );
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
