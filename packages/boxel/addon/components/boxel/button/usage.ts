/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { isBlank } from '@ember/utils';
import './usage.css';

const sizeVariants = ['extra-small', 'small', 'base', 'tall', 'touch'] as const;
type SizeVariant = typeof sizeVariants[number];

export default class extends Component {
  sizeVariants = sizeVariants;
  kindVariants = {
    all: [
      'primary',
      'primary-dark',
      'secondary-light',
      'secondary-dark',
      'danger',
    ],
    light: ['primary', 'secondary-light'],
    dark: ['primary', 'secondary-dark'],
  };

  // base button arguments
  @tracked as = 'button';
  @tracked size: SizeVariant = 'base';
  @tracked kind = 'primary';
  @tracked disabled = false;
  @tracked loading = false;

  @tracked color = 'var(--boxel-purple-300)';
  @tracked border = '1px solid var(--boxel-purple-300)';
  @tracked textColor = 'var(--boxel-purple-600)';

  @tracked minWidth = '120px';

  paddings = {
    'extra-small': 'var(--boxel-sp-xxxs) var(--boxel-sp)',
    small: 'var(--boxel-sp-xxxs) var(--boxel-sp)',
    base: 'var(--boxel-sp-xxxs) var(--boxel-sp-xl)',
    tall: 'var(--boxel-sp-xs) var(--boxel-sp-lg)',
    touch: 'var(--boxel-sp-xs) var(--boxel-sp-lg)',
  };

  fonts = {
    'extra-small': 'var(--boxel-font-xs)',
    small: '600 var(--boxel-font-sm)',
    base: '600 var(--boxel-font-sm)',
    tall: '600 var(--boxel-font-sm)',
    touch: '600 var(--boxel-font)',
  };

  loadingIconSizes = {
    'extra-small': 'var(--boxel-font-size-xs)',
    small: 'var(--boxel-font-size-sm)',
    base: 'var(--boxel-font-size-sm)',
    tall: 'var(--boxel-font-size-sm)',
    touch: 'var(--boxel-font-size)',
  };

  letterSpacings = {
    'extra-small': 'var(--boxel-lsp-lg)',
    small: 'var(--boxel-lsp)',
    base: 'var(--boxel-lsp)',
    tall: 'var(--boxel-lsp)',
    touch: 'var(--boxel-lsp-xs)',
  };

  minHeights = {
    'extra-small': '1.8125rem',
    small: '2rem',
    base: '2rem',
    tall: '2.5rem',
    touch: '3rem',
  };

  @tracked paddingOverride: string | undefined;
  @tracked fontOverride: string | undefined;
  @tracked loadingIconSizeOverride: string | undefined;
  @tracked letterSpacingOverride: string | undefined;
  @tracked minHeightOverride: string | undefined;

  get padding() {
    if (isBlank(this.paddingOverride)) {
      return this.paddings[this.size];
    } else {
      return this.paddingOverride;
    }
  }

  get font() {
    if (isBlank(this.fontOverride)) {
      return this.fonts[this.size];
    } else {
      return this.fontOverride;
    }
  }

  get loadingIconSize() {
    if (isBlank(this.loadingIconSizeOverride)) {
      return this.loadingIconSizes[this.size];
    } else {
      return this.loadingIconSizeOverride;
    }
  }

  get letterSpacing() {
    if (isBlank(this.letterSpacingOverride)) {
      return this.letterSpacings[this.size];
    } else {
      return this.letterSpacingOverride;
    }
  }

  get minHeight() {
    if (isBlank(this.minHeightOverride)) {
      return this.minHeights[this.size];
    } else {
      return this.minHeightOverride;
    }
  }

  // for @as === 'anchor'
  @tracked href = '#';

  // for @as === 'link-to'
  @tracked route = 'docs.index';
  // @model and @query seem hard to use here so leaving them aside for now

  @action
  alert(): void {
    alert('Hey! You clicked the button.');
  }
}
