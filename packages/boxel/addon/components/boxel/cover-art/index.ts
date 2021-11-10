import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface CoverArtUsage {
  size: number | undefined;
  maxWidth: number | undefined;
  spacingMultiplier: number | undefined;
  covers: [];
}

export default class CoverArt extends Component<CoverArtUsage> {
  @reads('args.size', 80) declare size: number;
  @reads('args.maxWidth', 190) declare maxWidth: number;
  @reads('args.spacingMultiplier', 1) declare spacingMultiplier: number;

  get coverArtSpacing(): number {
    let {
      maxWidth,
      args: { covers },
    } = this;
    let naturalWidth =
      this.coverArtSize(covers.length) + this.coverArtLeft(covers.length, 1.0); // approx
    let spacingRatio = maxWidth / naturalWidth;

    return Math.min(1, spacingRatio);
  }

  @action coverArtSize(index: number): number {
    return this.size * 0.8 ** index;
  }

  @action coverArtSizePx(index: number): string {
    return `${this.coverArtSize(index)}px`;
  }

  @action coverArtLeft(index: number, spacing: number): number {
    return this.size * 0.8 * index * 0.85 ** index * spacing;
  }

  @action coverArtLeftPx(index: number, spacing: number): string {
    return `${this.coverArtLeft(index, spacing)}px`;
  }
}
