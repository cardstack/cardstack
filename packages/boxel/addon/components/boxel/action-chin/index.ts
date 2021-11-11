import Component from '@glimmer/component';
import { equal } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';

enum ActionChinState {
  // state before the cta has been activated/the action done
  default = 'default',
  // disabled state - currently visually corresponds to the default state.
  // design has no immediate plans to make a disabled state for the memorialized cta
  disabled = 'disabled',
  // in progress state - action has been taken, but not completed
  inProgress = 'in-progress',
  // memorialized state - requirement for CTA has been met
  memorialized = 'memorialized',
}

interface ActionChinArguments {
  stepNumber: number;
  state: ActionChinState;
}
export default class ActionChin extends Component<ActionChinArguments> {
  // convenience getters for state booleans. they are mutually exclusive since all are
  // derived from the args.state argument.
  @equal('args.state', ActionChinState.default) declare isDefault: boolean;
  @equal('args.state', ActionChinState.inProgress)
  declare isInProgress: boolean;
  @equal('args.state', ActionChinState.memorialized)
  declare isMemorialized: boolean;
}
