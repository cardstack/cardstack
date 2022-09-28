import Component from '@glimmer/component';
import { or } from 'macro-decorators';
import { htmlSafe } from '@ember/template';
import { SafeString } from '@ember/template/-private/handlebars';
import { concat } from '@ember/helper';
import type { EmptyObject } from '@ember/component/helper';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    percentComplete: number;
    size?: number;
  },
  Blocks: EmptyObject;
}

export default class ProgressCircle extends Component<Signature> {

  <template>
    <div
      class="boxel-progress-circle"
      style={{htmlSafe (concat "width:" this.size "px;height:" this.size "px;")}}
      ...attributes
    >
      <div
        class="boxel-progress-circle__pie"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width={{this.size}} height={{this.size}} viewBox="0 0 {{this.outerCircleDiameter}} {{this.outerCircleDiameter}}">
          <g stroke-width="{{this.progressArcThickness}}">
            <circle 
              cx={{this.outerCircleRadius}} 
              cy={{this.outerCircleRadius}}  
              r={{this.strokeCircleRadius}} 
              class="boxel-progress-circle__background-circle"
            />
            <circle 
              cx={{this.outerCircleRadius}} 
              cy={{this.outerCircleRadius}}  
              r={{this.strokeCircleRadius}} 
              class="boxel-progress-circle__indicator-circle"
              style={{this.pieStyle}}
            />
          </g>
        </svg>
      </div>
      <div
        class="boxel-progress-circle__pct-label"
        style={{htmlSafe (concat "font-size:" this.fontSize "px;width:" this.percentLabelDiameter "px; height:" this.percentLabelDiameter "px;")}}
      >
        {{this.humanPercentComplete}}%
      </div>
    </div>

  </template>
  
  progressArcThickness = 12;
  outerCircleRadius = 60;
  innerCircleRadius = this.outerCircleRadius - this.progressArcThickness;
  strokeCircleRadius = (this.outerCircleRadius + this.innerCircleRadius) / 2;
  outerCircleDiameter = this.outerCircleRadius * 2;
  innerCircleDiameter = this.innerCircleRadius * 2;
  strokeCircleCircumference = this.strokeCircleRadius * 2 * Math.PI;
  @or('args.size', 'outerCircleDiameter') declare size: number;

  get pieStyle(): SafeString {
    return htmlSafe(
      `stroke-dasharray: ${this.progressArcLength} ${this.strokeCircleCircumference}`
    );
  }
  get progressArcLength(): number {
    return (this.args.percentComplete / 100) * this.strokeCircleCircumference;
  }
  get scale(): number {
    return this.size / this.outerCircleDiameter;
  }
  get fontSize(): number {
    return this.scale * 25;
  }
  get percentLabelDiameter(): number {
    return this.scale * this.innerCircleDiameter;
  }
  get humanPercentComplete(): number {
    if (this.args.percentComplete) {
      return Math.round(this.args.percentComplete);
    }
    return 0;
  }
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ProgressCircle': typeof ProgressCircle;
  }
}
