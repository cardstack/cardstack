import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { dropTask } from 'ember-concurrency-decorators';
import fetch from 'fetch';

const AudioContext = window.AudioContext || window.webkitAudioContext;

export default class WavePlayerComponent extends Component {
  width = 600;
  height = 152;
  barWidth = 5;
  barPadding = 2;

  // how many samples to take per bar drawn as a ratio from 0 to 1. More samples is more accurate but much slower
  sampleRatio = 0.1;

  unplayedColor = '#D8D8D8';
  playedColor = '#00EBE5';

  @tracked currentTime = 0;
  @tracked isPlaying = false;
  @tracked duration = 0;

  get style() {
    return `
    width: ${this.width / 2}px;
    height: ${this.height / 2}px;
    `;
  }

  willDestroy() {
    super.willDestroy(...arguments);
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  @action
  async setupPlayer(canvas) {
    this.canvas = canvas;
    let { url } = this.args;

    let response = await fetch(url);

    let buffer = await response.arrayBuffer();
    let audioContext = new AudioContext();
    let decodedData = await decodeAudioData(audioContext, buffer);

    let data = decodedData.getChannelData(0);
    let barCount = Math.floor(
      this.canvas.width / (this.barWidth + this.barPadding)
    );

    let scaler = makeScaler(barCount, data.length);

    this.barValues = [];

    for (let x of range(barCount)) {
      let startIdx = Math.floor(scaler(x)),
        endIdx = Math.ceil(scaler(x + 1));
      let slice = data.slice(startIdx, endIdx);

      let samplesToTake = Math.floor(this.sampleRatio * slice.length);
      let sum = 0;
      for (let i of range(samplesToTake)) {
        sum += Math.pow(slice[i / this.sampleRatio], 2);
      }

      let rms = Math.sqrt(sum / samplesToTake);
      this.barValues.push(rms);
    }

    this.draw();
    this.setupAudio(url);
  }

  draw() {
    let context = this.canvas.getContext('2d');
    context.save();
    context.fillStyle = '#fff';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    context.lineWidth = this.barWidth;
    context.translate(0, this.canvas.height / 2);
    for (let i = 0; i < this.barValues.length; i++) {
      let fractionThroughBars = i / this.barValues.length;
      if (fractionThroughBars > this.fractionThroughTrack) {
        context.strokeStyle = this.unplayedColor;
      } else {
        context.strokeStyle = this.playedColor;
      }

      let x = Math.floor((this.canvas.width * i) / this.barValues.length);
      let y = this.barValues[i] * this.canvas.height;
      context.beginPath();
      context.moveTo(x, -y);
      context.lineTo(x, y);
      context.stroke();
    }
    context.restore();
  }

  get fractionThroughTrack() {
    if (!this.audio || !this.audio.duration) {
      return 0;
    }
    return this.currentTime / this.audio.duration;
  }

  setupAudio(url) {
    this.audio = new Audio(url);
    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.draw();
    });
    this.audio.addEventListener('play', () => (this.isPlaying = true));
    this.audio.addEventListener('pause', () => (this.isPlaying = false));
    this.audio.addEventListener(
      'durationchange',
      () => (this.duration = this.audio.duration)
    );
  }

  @dropTask *playPause() {
    if (this.isPlaying) {
      yield this.audio.pause();
    } else {
      yield this.audio.play();
    }
  }

  @action canvasClick(event) {
    let rect = event.target.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let clickFraction = x / (rect.right - rect.left);

    this.audio.currentTime = clickFraction * this.audio.duration;
  }
}

function range(n) {
  return [...Array(n).keys()];
}

function makeScaler(domain, range) {
  return (x) => (range / domain) * x;
}

async function decodeAudioData(audioContext, buffer) {
  return await new Promise((resolve) =>
    audioContext.decodeAudioData(buffer, resolve)
  );
}
