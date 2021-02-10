import Component from '@glimmer/component';
import { or } from 'macro-decorators';
import { htmlSafe } from '@ember/template';
export default class extends Component {
  progressArcThickness = 12;
  outerCircleRadius = 60;
  innerCircleRadius = this.outerCircleRadius - this.progressArcThickness;
  strokeCircleRadius = (this.outerCircleRadius + this.innerCircleRadius) / 2;
  outerCircleDiameter = this.outerCircleRadius * 2;
  innerCircleDiameter = this.innerCircleRadius * 2;
  strokeCircleCircumference = this.strokeCircleRadius * 2 * Math.PI;
  @or('args.size', 'outerCircleDiameter') size;

  get pieStyle() {
    return htmlSafe(
      `stroke-dasharray: ${this.progressArcLength} ${this.strokeCircleCircumference}`
    );
  }
  get progressArcLength() {
    return (this.args.percentComplete / 100) * this.strokeCircleCircumference;
  }
  get scale() {
    return this.size / this.outerCircleDiameter;
  }
  get fontSize() {
    return this.scale * 25;
  }
  get percentLabelDiameter() {
    return this.scale * this.innerCircleDiameter;
  }
  get humanPercentComplete() {
    if (this.args.percentComplete) {
      return Math.round(this.args.percentComplete);
    }
    return 0;
  }
}
