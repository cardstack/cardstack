import Component from '@glimmer/component';
import { equal } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelButton from '../button';
import ActionStatusArea from './action-status-area';
import InfoArea from './info-area';
import cn from 'ember-class-names-helper/helpers/class-names';
import { concat, hash } from '@ember/helper';
import and from 'ember-truth-helpers/helpers/and';
import or from 'ember-truth-helpers/helpers/or';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

export enum ActionChinState {
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

interface DefaultBlockArgs {
  ActionButton: typeof BoxelButton;
  CancelButton: typeof BoxelButton;
  ActionStatusArea: typeof ActionStatusArea;
  InfoArea: typeof InfoArea;
}

interface MemorializedBlockArgs {
  ActionButton: typeof BoxelButton;
  ActionStatusArea: typeof ActionStatusArea;
  InfoArea: typeof InfoArea;
}

interface InProgressBlockArgs {
  ActionButton: typeof BoxelButton;
  CancelButton: typeof BoxelButton;
  ActionStatusArea: typeof ActionStatusArea;
  InfoArea: typeof InfoArea;
}

interface Signature {
  Element: HTMLDivElement;
  Args: {
    stepNumber?: number;
    state: ActionChinState;
    disabled?: boolean;
  };
  Blocks: {
    'default': [DefaultBlockArgs],
    'memorialized': [MemorializedBlockArgs],
    'inProgress': [InProgressBlockArgs],
  }
}

export default class ActionChin extends Component<Signature> {
  // convenience getters for state booleans. they are mutually exclusive since all are
  // derived from the args.state argument.
  @equal('args.state', ActionChinState.default) declare isDefault: boolean;
  @equal('args.state', ActionChinState.inProgress)
  declare isInProgress: boolean;
  @equal('args.state', ActionChinState.memorialized)
  declare isMemorialized: boolean;

  <template>
    <div
      class={{cn
        "boxel-action-chin"
        (if @state (concat "boxel-action-chin--" @state))
        (if @disabled "boxel-action-chin--disabled")
        (if @stepNumber (concat "boxel-action-chin--has-step"))
      }}
      ...attributes
      data-test-boxel-action-chin
      data-test-boxel-action-chin-state={{@state}}
    >
      {{!-- Not accounting for 0 as a step number --}}
      {{#if @stepNumber}}
        <div class="boxel-action-chin__step" data-step={{@stepNumber}} data-test-boxel-action-chin-step={{@stepNumber}}>
          <span class="boxel-sr-only">Step {{@stepNumber}}</span>
        </div>
      {{/if}}
      {{#if (and (has-block "inProgress") this.isInProgress)}}
        {{yield
          (hash
            ActionButton=(component
              BoxelButton
              kind="primary"
              loading=true
              disabled=@disabled
              class="boxel-action-chin__action-button"
            )
            CancelButton=(component
              BoxelButton
              kind="secondary-dark"
              disabled=@disabled
              class="boxel-action-chin__cancel-button"
            )
            ActionStatusArea=(component
              ActionStatusArea
            )
            InfoArea=(component
              InfoArea
              class="boxel-action-chin__info-area"
            )
          )
          to="inProgress"
        }}
      {{else if (and (has-block "memorialized") this.isMemorialized)}}
        {{!--
          if using ActionButton and ActionStatusArea together, the grid layout will put them at the exact same spot,
          causing a visual bug.
        --}}
        {{yield
          (hash
            ActionButton=(component
              BoxelButton
              kind="secondary-light"
              class="boxel-action-chin__memorialized-action-button"
              disabled=@disabled
            )
            ActionStatusArea=(component
              ActionStatusArea
              icon="success"
            )
            InfoArea=(component
              InfoArea
              class="boxel-action-chin__info-area"
            )
          )
          to="memorialized"
        }}
      {{else}}
        {{yield
          (hash
            ActionButton=(component
              BoxelButton
              kind="primary"
              disabled=@disabled
            )
            CancelButton=(component
              BoxelButton
              kind="secondary-dark"
              disabled=@disabled
              class="boxel-action-chin__cancel-button"
            )
            ActionStatusArea=(component
              ActionStatusArea
            )
            InfoArea=(component
              InfoArea
              class="boxel-action-chin__info-area"
            )
          )
        }}
      {{/if}}
      {{!-- in any state except: disabled + has a step, we want the lock shown --}}
      {{!-- template-lint-disable simple-unless --}}
      {{#unless (and @disabled @stepNumber)}}
        <span class="boxel-action-chin__private-notice" data-test-boxel-action-chin-private-notice>Actions only visible to you</span>
        {{svgJar "lock" class="boxel-action-chin__lock-icon" role="presentation"}}
      {{/unless}}
    </div>
  </template>
}
