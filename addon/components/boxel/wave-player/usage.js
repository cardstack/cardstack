import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';

export default class BoxelWaveplayerUsageComponent extends Component {
  @tracked url = '/@cardstack/boxel/assets/demo_flac.flac';
}
