import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { dropTask } from 'ember-concurrency-decorators';

export default class PlayButtonComponent extends Component {
  url = '/boxel/assets/demo_flac.flac';
  @tracked isPlaying = false;

  willDestroy() {
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  @action
  setupAudio() {
    this.audio = new Audio(this.url);
    this.audio.addEventListener('play', () => this.isPlaying = true);
    this.audio.addEventListener('pause', () => this.isPlaying = false);
  }

  @dropTask * playPause() {
    if (this.isPlaying) {
      yield this.audio.pause();
    } else {
      yield this.audio.play();
    }
  }
}
