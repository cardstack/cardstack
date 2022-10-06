import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelWavePlayer from './index';
import { fn } from '@ember/helper';

import { tracked } from '@glimmer/tracking';
import demoFlac from '../../../public/@cardstack/boxel/assets/demo_flac.flac';

export default class BoxelWaveplayerUsageComponent extends Component {
  @tracked url = demoFlac;
  <template>
    <FreestyleUsage @name="WavePlayer">
      <:example>
        <BoxelWavePlayer @url={{this.url}} />
      </:example>

      <:api as |Args|>
        <Args.String
          @name="url"
          @required={{true}}
          @description="A path to an audio asset"
          @value={{this.url}}
          @onInput={{fn (mut this.url)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
