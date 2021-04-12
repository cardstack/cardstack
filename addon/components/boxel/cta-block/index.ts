import Component from '@glimmer/component';
import { action } from '@ember/object';

enum CtaBlockState {
  atRest = 'atRest',
  disabled = 'disabled',
  inProgress = 'inProgress',
  done = 'done',
}

enum SectionNames {
  step = 'step',
  mainAction = 'mainAction',
  cancelAction = 'cancelAction',
  locked = 'locked',
  statusView = 'statusView',
}

interface CtaBlockStateDescription {
  text: string;
  action?: () => void;
  // only used by the inProgressArgs
  cancelText?: string;
  cancelAction?: () => void;
}

interface CtaBlockArguments {
  stepNumber: number;
  canEdit: boolean;
  canCancel: boolean;
  state: CtaBlockState;
  atRestArgs: CtaBlockStateDescription;
  disabledArgs: CtaBlockStateDescription;
  inProgressArgs: CtaBlockStateDescription;
  doneArgs: CtaBlockStateDescription;
}

interface LayoutConfig {
  [sectionName: string]: boolean;
}

export default class CtaBlock extends Component<CtaBlockArguments> {
  get layout(): LayoutConfig {
    const res: LayoutConfig = {};
    const addSections = (sections: SectionNames[]) => {
      for (const section of sections) {
        res[section] = true;
      }
    };

    if (this.args.stepNumber) {
      addSections([SectionNames.step]);
    }

    if (this.args.state === CtaBlockState.atRest) {
      addSections([SectionNames.mainAction, SectionNames.locked]);
    } else if (this.args.state === CtaBlockState.disabled) {
      addSections([SectionNames.mainAction]);
    } else if (this.args.state === CtaBlockState.done) {
      addSections([
        SectionNames.mainAction,
        this.args.canEdit ? SectionNames.locked : SectionNames.statusView,
      ]);
    } else if (this.args.state === CtaBlockState.inProgress) {
      addSections([SectionNames.mainAction, SectionNames.locked]);
      if (this.args.canCancel) addSections([SectionNames.cancelAction]);
    }

    return res;
  }

  get theme(): string {
    if (this.args.state === CtaBlockState.done) {
      return 'light';
    } else {
      return 'dark';
    }
  }

  // Text of the primary action button of this CTA
  // Or text of the done state message
  get mainActionText(): string {
    if (this.args.state === CtaBlockState.atRest) {
      return this.args.atRestArgs.text;
    } else if (this.args.state === CtaBlockState.disabled) {
      return this.args.disabledArgs.text;
    } else if (this.args.state === CtaBlockState.inProgress) {
      return this.args.inProgressArgs.text;
    } else if (this.args.state === CtaBlockState.done) {
      return this.args.doneArgs.text;
    } else {
      return '';
    }
  }

  get mainActionButtonKind(): string {
    if (this.theme === 'dark') {
      return 'primary';
    } else {
      return 'secondary-light';
    }
  }

  @action
  mainAction(): void {
    if (this.args.state === CtaBlockState.atRest) {
      if (this.args.atRestArgs.action) return this.args.atRestArgs.action();
    } else if (this.args.state === CtaBlockState.done && this.args.canEdit) {
      if (this.args.doneArgs.action) return this.args.doneArgs.action();
    }
  }

  cancelActionButtonkind = 'secondary-dark';

  get cancelActionText(): string {
    return this.args.inProgressArgs.cancelText || '';
  }

  @action
  cancelAction(): void {
    if (this.args.state === CtaBlockState.inProgress && this.args.canCancel) {
      if (this.args.inProgressArgs.cancelAction)
        return this.args.inProgressArgs.cancelAction();
    }
  }
}
