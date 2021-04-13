import Component from '@glimmer/component';
import { action } from '@ember/object';
import { equal, reads } from 'macro-decorators';

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
  // convenience getters for state booleans. they are mutually exclusive since all are
  // derived from the args.state argument.
  @equal('args.state', CtaBlockState.atRest) declare isAtRest: boolean;
  @equal('args.state', CtaBlockState.disabled) declare isDisabled: boolean;
  @equal('args.state', CtaBlockState.inProgress) declare isInProgress: boolean;
  @equal('args.state', CtaBlockState.done) declare isDone: boolean;
  @reads('args.stepNumber', null) declare stepNumber: number;

  get layout(): LayoutConfig {
    const res: LayoutConfig = {};
    const addSections = (sections: SectionNames[]) => {
      for (const section of sections) {
        res[section] = true;
      }
    };

    if (this.stepNumber) {
      addSections([SectionNames.step]);
    }

    if (this.isAtRest) {
      addSections([SectionNames.mainAction, SectionNames.locked]);
    } else if (this.isDisabled) {
      addSections([SectionNames.mainAction]);
    } else if (this.isDone) {
      addSections([
        SectionNames.mainAction,
        this.args.canEdit ? SectionNames.locked : SectionNames.statusView,
      ]);
    } else if (this.isInProgress) {
      addSections([SectionNames.mainAction, SectionNames.locked]);
      if (this.args.canCancel) addSections([SectionNames.cancelAction]);
    }

    return res;
  }

  get theme(): string {
    if (this.isDone) {
      return 'light';
    } else {
      return 'dark';
    }
  }

  get mainActionIsButton(): boolean {
    return !this.isDone || this.args.canEdit;
  }

  // Text of the primary action button of this CTA
  // Or text of the done state message
  get mainActionText(): string {
    if (this.isAtRest) {
      return this.args.atRestArgs.text;
    } else if (this.isDisabled) {
      return this.args.disabledArgs.text;
    } else if (this.isInProgress) {
      return this.args.inProgressArgs.text;
    } else if (this.isDone) {
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
    if (this.isAtRest) {
      if (this.args.atRestArgs.action) return this.args.atRestArgs.action();
    } else if (this.isDone && this.args.canEdit) {
      if (this.args.doneArgs.action) return this.args.doneArgs.action();
    }
  }

  cancelActionButtonKind = 'secondary-dark';

  get cancelActionText(): string {
    return this.args.inProgressArgs.cancelText || '';
  }

  @action
  cancelAction(): void {
    if (this.isInProgress && this.args.canCancel) {
      if (this.args.inProgressArgs.cancelAction)
        return this.args.inProgressArgs.cancelAction();
    }
  }
}
