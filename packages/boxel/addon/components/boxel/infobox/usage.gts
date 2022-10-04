import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInfobox from './index';

import { tracked } from '@glimmer/tracking';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { fn } from '@ember/helper';

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

  <template>
    <FreestyleUsage @name="InfoBox">
      <:example>
        <BoxelInfobox 
          @title={{this.title}} 
          @description={{this.description}} 
          style={{cssVar 
            boxel-infobox-image=this.imageUrl
            boxel-infobox-image-size=this.imageSize
            boxel-infobox-image-position=this.imagePosition
            boxel-infobox-text-width=this.textWidth
          }}
        />
      </:example>

      <:api as |Args|>
        <Args.String
          @name="title"
          @value={{this.title}}
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="description"
          @value={{this.description}}
          @onInput={{fn (mut this.description)}}
        />
        <Args.String
          @name="--boxel-infobox-image"
          @value={{this.image}}
          @onInput={{fn (mut this.image)}}
        />
        <Args.String
          @name="--boxel-infobox-image-position"
          @value={{this.imagePosition}}
          @onInput={{fn (mut this.imagePosition)}}
        />
        <Args.String
          @name="--boxel-infobox-image-size"
          @value={{this.imageSize}}
          @onInput={{fn (mut this.imageSize)}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-infobox-text-width"
          @default={{unbound this.textWidth}}
          @value={{this.textWidth}}
          @onInput={{fn (mut this.textWidth)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
