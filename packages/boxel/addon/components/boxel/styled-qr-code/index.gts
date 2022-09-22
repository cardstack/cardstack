import Component from '@glimmer/component';
import BoxelLoadingIndicator from '../loading-indicator';
import QRCodeStyling from 'qr-code-styling';
import { reads } from 'macro-decorators';
import {
  CornerDotType,
  CornerSquareType,
  DotType,
} from 'qr-code-styling/lib/types';
import Modifier from 'ember-modifier';
import { type EmptyObject } from '@ember/component/helper';

import './index.css';

interface StyledQrCodeComponentArgs {
  size: number | undefined; // Size of canvas (default 300)
  data: string; // The data to be encoded in the QR code
  margin: number | undefined; // Margin around canvas (default 0)
  image: string | undefined; // URL of an image to be rendered in the center of the QR code
  backgroundColor: string | undefined;
  dotType: DotType | undefined;
  dotColor: string | undefined;
  cornerDotColor: string | undefined;
  cornerDotType: CornerDotType | undefined;
  cornerSquareColor: string | undefined;
  cornerSquareType: CornerSquareType | undefined;
  imageMargin: number | undefined; // Margin around image (default 0)
}

interface Signature {
 Element: HTMLDivElement;
 Args: Partial<StyledQrCodeComponentArgs>;
 Blocks: {
  before: [];
  default: [];
 };
};

interface RenderQRCodeSignature {
  Element: HTMLDivElement;
  Args: {
    Positional: [options: any];
    Named: EmptyObject;
  };
}

class RenderQrCodeModifier extends Modifier<RenderQRCodeSignature> {
  qrCode: QRCodeStyling | undefined;
  modify(element: HTMLDivElement, [options]: [any]) {
    if (this.qrCode) {
      this.qrCode.update(options);
    } else {
      this.qrCode = new QRCodeStyling(options);
      this.qrCode.append(element);
    }
  }
}

export default class StyledQrCodeComponent extends Component<Signature> {
  @reads('args.size', 300) declare size: number;
  @reads('args.backgroundColor', '#ffffff') declare backgroundColor: string;
  @reads('args.dotColor', '#000000') declare dotColor: string;
  @reads('args.dotType', 'square') declare dotType: DotType;
  @reads('args.margin', 0) declare margin: number;
  @reads('args.imageMargin', 0) declare imageMargin: number;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  get qrOptions() {
    return {
      width: this.size,
      height: this.size,
      margin: this.margin,
      data: this.args.data,
      image: this.args.image,
      dotsOptions: {
        color: this.dotColor,
        type: this.dotType,
      },
      backgroundOptions: {
        color: this.backgroundColor,
      },
      cornersDotOptions: {
        color: this.args.cornerDotColor,
        type: this.args.cornerDotType,
      },
      cornersSquareOptions: {
        color: this.args.cornerSquareColor,
        type: this.args.cornerSquareType,
      },
      imageOptions: {
        //   crossOrigin: 'anonymous',
        margin: this.imageMargin,
        hideBackgroundDots: false,
      },
    };
  }

  <template>
    <div
      class="boxel-styled-qr-code"
      data-test-boxel-styled-qr-code={{@data}}
      ...attributes
    >
      {{yield to="before"}}

      <div class="boxel-styled-qr-code__canvas" {{RenderQrCodeModifier this.qrOptions}}>
        <BoxelLoadingIndicator
          class="boxel-styled-qr-code__loading-indicator"
          data-test-boxel-styled-qr-code-loading-indicator
        />
      </div>

      {{#if (has-block)}}
        {{yield}}
      {{/if}}
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::StyledQrCode': typeof StyledQrCodeComponent;
  }
}
