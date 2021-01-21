import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import LovetheLoveThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Love-the-Love.jpg';
import HomeIsntSweetThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Home-Isnt-Sweet.jpg';
import NeverLonelyThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Never-Lonely.jpg';
import OntheBrinkofHappinessThumb from '@cardstack/boxel/images/media-registry/covers/thumb/On-the-Brink-of-Happiness.jpg';
import ZigandZagThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Zig-and-Zag.jpg';
import AllAbouttheQualityofLifeThumb from '@cardstack/boxel/images/media-registry/covers/thumb/All-About-the-Quality-of-Life.jpg';
import LoveConquersAllThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Love-Conquers-All.jpg';
import MakeMagicThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Make-Magic.jpg';
import GoodTimesThumb from '@cardstack/boxel/images/media-registry/covers/thumb/Good-Times.jpg';
import MoreThanWeKnowThumb from '@cardstack/boxel/images/media-registry/covers/thumb/More-Than-We-Know.jpg';
export default class extends Component {
  @tracked numToShow = 5;
  @tracked size = 80;
  @tracked maxWidth = 190;
  coverThumbs = [
    LovetheLoveThumb,
    HomeIsntSweetThumb,
    NeverLonelyThumb,
    OntheBrinkofHappinessThumb,
    ZigandZagThumb,
    AllAbouttheQualityofLifeThumb,
    LoveConquersAllThumb,
    MakeMagicThumb,
    GoodTimesThumb,
    MoreThanWeKnowThumb
  ];
  get coverThumbsToShow() {
    return this.coverThumbs.slice(0, this.numToShow);
  }
}
