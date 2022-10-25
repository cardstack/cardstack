import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInfobox from './index';

import { tracked } from '@glimmer/tracking';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { fn } from '@ember/helper';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

import rightInfoboxImage from '@cardstack/boxel/usage-support/images/infobox-image.svg';

export default class InfoboxUsage extends Component {
  @tracked title = 'Add cards to your space';
  @tracked description =
    'You can drag and drop different types of cards from the Card Catalog into your space. Once you’ve added a card, you can configure its fields and edit the content.';

  cssClassName = 'boxel-infobox';
  @cssVariable declare boxelInfoboxImagePosition: CSSVariableInfo;
  @cssVariable declare boxelInfoboxImageSize: CSSVariableInfo;
  @cssVariable declare boxelInfoboxTextWidth: CSSVariableInfo;
  @tracked image = rightInfoboxImage;

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
            boxel-infobox-image-size=this.boxelInfoboxImageSize.value
            boxel-infobox-image-position=this.boxelInfoboxImagePosition.value
            boxel-infobox-text-width=this.boxelInfoboxTextWidth.value
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
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-infobox-text-width"
          @type="dimension"
          @description="Used to set the width of the text portion"
          @defaultValue={{this.boxelInfoboxTextWidth.defaults}}
          @value={{this.boxelInfoboxTextWidth.value}}
          @onInput={{this.boxelInfoboxTextWidth.update}}
        />
        <Css.Basic
          @name="boxel-infobox-image"
          @type="url"
          @description="set as the background image of the infobox"
          @value={{this.image}}
          @onInput={{fn (mut this.image)}}
        />
        <Css.Basic
          @name="boxel-infobox-image-position"
          @type="position"
          @description="Sets the position of the boxel-infobox-image"
          @defaultValue={{this.boxelInfoboxImagePosition.defaults}}
          @value={{this.boxelInfoboxImagePosition.value}}
          @onInput={{this.boxelInfoboxImagePosition.update}}
        />
        <Css.Basic
          @name="boxel-infobox-image-size"
          @type="bg-size"
          @description="Used to set the size of the boxel-infobox-image"
          @defaultValue={{this.boxelInfoboxImageSize.defaults}}
          @value={{this.boxelInfoboxImageSize.value}}
          @onInput={{this.boxelInfoboxImageSize.update}}
        />
      </:cssVars>
    </FreestyleUsage>
  </template>
}
