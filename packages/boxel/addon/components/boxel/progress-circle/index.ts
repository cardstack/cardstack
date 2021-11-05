import Component from '@glimmer/component';
import { or } from 'macro-decorators';
import { htmlSafe } from '@ember/template';
import { SafeString } from '@ember/template/-private/handlebars';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface ProgressCircleArgs {
  percentComplete: number;
  size: number;
}

export default class ProgressCircle extends Component<ProgressCircleArgs> {
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
