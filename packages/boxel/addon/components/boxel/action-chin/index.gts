import Component from '@glimmer/component';
import { equal } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelButton from '../button';
import ActionStatusArea, { StatusAreaSignature } from './action-status-area';
import InfoArea, { InfoAreaSignature } from './info-area';
import cn from '@cardstack/boxel/helpers/cn';

//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { concat, hash } from '@ember/helper';
import and from 'ember-truth-helpers/helpers/and';
import { ComponentLike, WithBoundArgs } from '@glint/template';
import { type ActionChinState} from './state';

interface DefaultBlockArgs {
  ActionButton: WithBoundArgs<typeof BoxelButton, 'kind'|'disabled'>;
  CancelButton: WithBoundArgs<typeof BoxelButton, 'kind'|'disabled'>;
  ActionStatusArea: ComponentLike<StatusAreaSignature>;
  InfoArea: ComponentLike<InfoAreaSignature>;
}

interface MemorializedBlockArgs {
  ActionButton: WithBoundArgs<typeof BoxelButton, 'kind'|'disabled'>;
  ActionStatusArea: WithBoundArgs<typeof ActionStatusArea, 'icon'>;
  InfoArea: ComponentLike<InfoAreaSignature>;
}

interface InProgressBlockArgs {
  ActionButton: WithBoundArgs<typeof BoxelButton, 'kind'|'disabled'|'loading'>;
  CancelButton: WithBoundArgs<typeof BoxelButton, 'kind'|'disabled'>;
  ActionStatusArea: ComponentLike<StatusAreaSignature>;
  InfoArea: ComponentLike<InfoAreaSignature>;
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
  @equal('args.state', 'default') declare isDefault: boolean;
  @equal('args.state', 'in-progress')
  declare isInProgress: boolean;
  @equal('args.state', 'memorialized')
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
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ActionChin': typeof ActionChin;
  }
}
