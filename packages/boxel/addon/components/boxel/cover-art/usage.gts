import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { A } from '@ember/array';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelCoverArt from './index';
import { fn } from '@ember/helper';

import LovetheLoveThumb from '@cardstack/boxel/usage-support/images/cover-art/Love-the-Love.jpg';
import HomeIsntSweetThumb from '@cardstack/boxel/usage-support/images/cover-art/Home-Isnt-Sweet.jpg';
import NeverLonelyThumb from '@cardstack/boxel/usage-support/images/cover-art/Never-Lonely.jpg';
import OntheBrinkofHappinessThumb from '@cardstack/boxel/usage-support/images/cover-art/On-the-Brink-of-Happiness.jpg';
import ZigandZagThumb from '@cardstack/boxel/usage-support/images/cover-art/Zig-and-Zag.jpg';
import AllAbouttheQualityofLifeThumb from '@cardstack/boxel/usage-support/images/cover-art/All-About-the-Quality-of-Life.jpg';
import LoveConquersAllThumb from '@cardstack/boxel/usage-support/images/cover-art/Love-Conquers-All.jpg';
import MakeMagicThumb from '@cardstack/boxel/usage-support/images/cover-art/Make-Magic.jpg';
import GoodTimesThumb from '@cardstack/boxel/usage-support/images/cover-art/Good-Times.jpg';
import MoreThanWeKnowThumb from '@cardstack/boxel/usage-support/images/cover-art/More-Than-We-Know.jpg';
import NativeArray from '@ember/array/-private/native-array';

export default class CoverArtUsage extends Component {
  @tracked size = 80;
  @tracked maxWidth = 190;
  @tracked spacingMultiplier = 1;
  @tracked coverThumbs: NativeArray<string> = A([
    LovetheLoveThumb,
    HomeIsntSweetThumb,
    NeverLonelyThumb,
    OntheBrinkofHappinessThumb,
    ZigandZagThumb,
    AllAbouttheQualityofLifeThumb,
    LoveConquersAllThumb,
    MakeMagicThumb,
    GoodTimesThumb,
    MoreThanWeKnowThumb,
  ]);

  @action updateCoverThumbs(covers: NativeArray<string>): void {
    this.coverThumbs = covers;
  }

  <template>
    <FreestyleUsage @name="CoverArt">
      <:example>
        <BoxelCoverArt
          @size={{this.size}}
          @maxWidth={{this.maxWidth}}
          @covers={{this.coverThumbs}}
          @spacingMultiplier={{this.spacingMultiplier}}
        />
      </:example>

      <:api as |Args|>
        <Args.Number
          @name="size"
          @defaultValue={{80}}
          @min={{20}}
          @max={{200}}
          @description="the size of the largest art, in px. Defaults to 80"
          @value={{this.size}}
          @onInput={{fn (mut this.size)}}
        />
        <Args.Number
          @name="maxWidth"
          @defaultValue={{190}}
          @min={{100}}
          @max={{500}}
          @step={{5}}
          @description="the maximum width of the layout"
          @value={{this.maxWidth}}
          @onInput={{fn (mut this.maxWidth)}}
        />
        <Args.Array
          @name="covers"
          @type="String"
          @required={{true}}
          @description="a collection of thumbnails to lay out. There is no reason to pass more than 5 as they are barely rendered"
          @items={{this.coverThumbs}}
          @onChange={{this.updateCoverThumbs}}
        />
        <Args.Number
          @name="spacingMultiplier"
          @defaultValue={{1}}
          @min={{0}}
          @max={{1.5}}
          @step={{0.1}}
          @description="Optional adjustment for how closely the covers are displayed"
          @value={{this.spacingMultiplier}}
          @onInput={{fn (mut this.spacingMultiplier)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
