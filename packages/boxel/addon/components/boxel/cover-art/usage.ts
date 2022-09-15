import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { A } from '@ember/array';

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
}
