import Component from '@glimmer/component';
import { action } from '@ember/object';
import { equal, reads } from 'macro-decorators';

enum CtaBlockState {
  // state before the cta has been activated/the action done
  atRest = 'atRest',
  // disabled state - currently visually corresponds to the atRest state.
  // might need to make one for the editable done state which has a light them
  // or change the way this is abstracted
  disabled = 'disabled',
  // in progress state - action has been taken, but not completed
  // you don't always have to go to this state.
  inProgress = 'inProgress',
  // done state - action has been done
  // if editable, there will be a button shown
  // if not, there will be a checkmark and text
  done = 'done',
}

// sections correspond to visual elements in the cta block
// not necessarily classes
enum SectionNames {
  // 'step' number before the action/its status
  step = 'step',
  // main action button
  mainAction = 'mainAction',
  // main action done status - not button
  mainActionDone = 'mainActionDone',
  // cancel action button
  cancelAction = 'cancelAction',
  // the locked message
  locked = 'locked',
  // shows the block passed to the CtaBlock component
  statusView = 'statusView',
}

interface CtaBlockStateDescription {
  // text on the main action button/the done status text
  text: string;
  // action that is called when the main action button is pressed
  action?: () => void;
  // text on the cancel button
  cancelText?: string;
  // action that is called when the cancel button is pressed
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
      addSections(
        this.args.canEdit
          ? [SectionNames.mainAction, SectionNames.locked]
          : [SectionNames.mainActionDone, SectionNames.statusView]
      );
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
