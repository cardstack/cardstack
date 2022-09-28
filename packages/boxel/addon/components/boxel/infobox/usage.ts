import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import rightInfoboxImage from '@cardstack/boxel/usage-support/images/infobox-image.svg';

export default class InfoboxUsage extends Component {
  @tracked image = rightInfoboxImage;
  @tracked imageSize = 'auto 100%';
  @tracked imagePosition = 'right -2.25rem bottom -2.25rem';
  @tracked title = 'Add cards to your space';
  @tracked description =
    'You can drag and drop different types of cards from the Card Catalog into your space. Once you’ve added a card, you can configure its fields and edit the content.';
  @tracked textWidth =
    'calc(21.25rem + var(--boxel-sp-xxl) + var(--boxel-sp-xxl))';

  get imageUrl(): string {
    return `url(${this.image})`;
  }
}
