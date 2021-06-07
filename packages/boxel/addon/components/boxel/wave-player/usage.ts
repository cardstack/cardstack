import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';
import demoFlac from '../../../public/@cardstack/boxel/assets/demo_flac.flac';

export default class BoxelWaveplayerUsageComponent extends Component {
  @tracked url = demoFlac;
}
