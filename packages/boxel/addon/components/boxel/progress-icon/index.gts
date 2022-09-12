import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';
import { SafeString } from '@ember/template/-private/handlebars';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import cn from '@cardstack/boxel/helpers/cn';
import not from 'ember-truth-helpers/helpers/not';
import or from 'ember-truth-helpers/helpers/or';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    isCancelled?: boolean;
    isComplete: boolean;
    fractionComplete: number;
    size: number;
  };
  Blocks: EmptyObject;
}

export default class ProgressIcon extends Component<Signature> {
  get elementStyle(): SafeString {
    let { size } = this.args;
    let styles = [`width: ${size}px`, `height: ${size}px`];
    if (this.args.isCancelled || this.args.isComplete) {
      styles.push(`background-size: ${size * 0.666}px ${size * 0.666}px`);
    }
    return htmlSafe(styles.join(';'));
  }

  get pieStyle(): SafeString {
    return htmlSafe(`stroke-dasharray:${this.args.fractionComplete*60} 60`);
  }

  get sizeString() {
    return this.args.size.toString();
  }

  <template>
    <div
      class={{cn
        "boxel-progress-icon"
        boxel-progress-icon--cancelled=@isCancelled
        boxel-progress-icon--complete=@isComplete
      }}
      style={{this.elementStyle}}
      ...attributes
    >
      {{#if (not (or @isCancelled @isComplete))}}
        <div class="boxel-progress-icon__progress-pie" style={{this.pieStyle}}>
          {{svgJar "progress-circle" width=this.sizeString height=this.sizeString}}
        </div>
      {{/if}}
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ProgressIcon': typeof ProgressIcon;
  }
}
