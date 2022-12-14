import Component from '@glimmer/component';
import cn from '@cardstack/boxel/helpers/cn';
import eq from 'ember-truth-helpers/helpers/eq';
import gt from 'ember-truth-helpers/helpers/gt';

import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { on } from '@ember/modifier';
import element from 'ember-element-helper/helpers/element';

import { fn, hash } from '@ember/helper';
import { action } from '@ember/object';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface ProgressStep {
  title: string;
  statusOnCompletion: string;
}

interface Signature {
  Element: HTMLUListElement;
  Args: {
    progressSteps?: any;
    completedCount: number;
    onClickStep?: (stepIndex: number) => void; 
  };
  Blocks: {
    'default': [{
      title: string;
      data: ProgressStep;
      index: number;
      completed: boolean;
      current: boolean;
    }],
  }
}

export default class ProgressSteps extends Component<Signature> {
  @action clickStep(i: number, ev: Event) {
    ev.preventDefault();
    if (this.args.onClickStep) {
      this.args.onClickStep(i);
    }
  }

  <template>
    <ul class="boxel-progress-steps" ...attributes>
      {{#each @progressSteps as |progressStep i|}}
        {{#let (gt @completedCount i) (eq @completedCount i) as |isCompleted isCurrent|}}
          <li
            class={{cn "boxel-progress-steps__item" boxel-progress-steps__item--completed=isCompleted boxel-progress-steps__item--current=isCurrent}}
          >
            {{#let (element (if @onClickStep "a" "span")) as |Tag|}}
              {{! @glint-expect-error couldn't quite figure out how to type ember-element-helper properly }}
              <Tag class="boxel-progress-steps__item-grid" href="#" {{on "click" (fn this.clickStep i)}}>
                <span class="boxel-progress-steps__item-bullet">
                  {{#if isCompleted}}
                    {{svgJar "check-mark" width="10px" height="10px"}}
                  {{/if}}
                </span>
                {{#if (has-block)}}
                  {{yield (hash title=progressStep.title data=progressStep index=i completed=isCompleted current=isCurrent)}}
                {{else}}
                  <span>{{progressStep.title}}</span>
                {{/if}}
              </Tag>
            {{/let}}
          </li>
        {{/let}}
      {{/each}}
    </ul>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ProgressSteps': typeof ProgressSteps;
  }
}
