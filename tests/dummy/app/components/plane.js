import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

export default class PlaneComponent extends Component {
  @service boxel;

  constructor() {
    super(...arguments);

    this.boxel.registerPlane(this);
  }
}
