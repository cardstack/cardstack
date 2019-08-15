import { tagName, layout as templateLayout } from '@ember-decorators/component';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/plane';

@templateLayout(layout)
@tagName('')
export default class PlaneComponent extends Component {
  @service boxel;

  init() {
    super.init(...arguments);

    this.boxel.registerPlane(this);
  }
}
