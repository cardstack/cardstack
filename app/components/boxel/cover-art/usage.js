import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked numToShow = 5;
  @tracked size = 80;
  @tracked maxWidth = 190;
  coverThumbs = [
    "media-registry/covers/thumb/Love-the-Love.jpg",
    "media-registry/covers/thumb/Home-Isnt-Sweet.jpg",
    "media-registry/covers/thumb/Never-Lonely.jpg",
    "media-registry/covers/thumb/On-the-Brink-of-Happiness.jpg",
    "media-registry/covers/thumb/Zig-and-Zag.jpg",
    "media-registry/covers/thumb/All-About-the-Quality-of-Life.jpg",
    "media-registry/covers/thumb/Love-Conquers-All.jpg",
    "media-registry/covers/thumb/Make-Magic.jpg",
    "media-registry/covers/thumb/Good-Times.jpg",
    "media-registry/covers/thumb/More-Than-We-Know.jpg"
  ];
  get coverThumbsToShow() {
    return this.coverThumbs.slice(0, this.numToShow);
  }
}
