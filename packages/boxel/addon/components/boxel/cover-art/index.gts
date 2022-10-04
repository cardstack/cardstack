import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { type EmptyObject } from '@ember/component/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { concat, fn } from '@ember/helper';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    size: number | undefined;
    maxWidth: number | undefined;
    spacingMultiplier: number | undefined;
    covers: string[];
  };
  Blocks: EmptyObject;
}

export default class CoverArt extends Component<Signature> {
  @reads('args.size', 80) declare size: number;
  @reads('args.maxWidth', 190) declare maxWidth: number;
  @reads('args.spacingMultiplier', 1) declare spacingMultiplier: number;

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

  get coverCount() {
    return this.args.covers.length;
  }

  <template>
    <div
      class="boxel-cover-art"
      style={{cssVar
        cover-art-width=(concat this.maxWidth "px")
        cover-art-size=(concat this.size "px")
        cover-art-count=this.coverCount
      }}
      ...attributes
    >
      {{#each @covers as |art i|}}
        <div
          class="boxel-cover-art__container boxel-cover-art__container--{{i}}"
          style={{cssVar
            cover-art-index=i
            cover-art-left=(fn this.coverArtLeftPx i this.coverArtSpacing)
            cover-art-cover-size=(fn this.coverArtSizePx i)
            cover-art-spacing-multiplier=this.spacingMultiplier
          }}
        >
          <img class="boxel-cover-art__cover" src={{art}} alt="cover art" />
        </div>
      {{/each}}
    </div>
  </template>

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
}
