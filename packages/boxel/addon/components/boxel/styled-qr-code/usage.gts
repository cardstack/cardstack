import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelStyledQrCode from './index';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';

export default class BoxelStyledQrCodeUsage extends Component {
  @tracked data = 'https://google.com';

  <template>
    <FreestyleUsage @name="StyledQrCode" @description="This is a wrapper for qr-code-styling. See the component source + qr-code-styling package documentation to understand available arguments.">
      <:example>
        <BoxelStyledQrCode
          @data={{this.data}}
          @size={{340}}
          @margin={{15}}
          @backgroundColor="#ffffff"
          @dotType="dots"
          @dotColor="#000"
          @cornerDotType="dot"
          @cornerSquareType="extra-rounded"
          @imageMargin={{5}}
        />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="data"
          @description="The URL or data to be rendered in the QR code"
          @value={{this.data}}
          @onInput={{fn (mut this.data)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="StyledQrCode loading" @description="If there is no URL or the QR code is still being generated, a loading indicator is shown.">
      <:example>
        <BoxelStyledQrCode />
      </:example>
    </FreestyleUsage>

  </template>  
}
