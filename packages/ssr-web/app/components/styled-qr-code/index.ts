import { action } from '@ember/object';
import Component from '@glimmer/component';
import QRCodeStyling from 'qr-code-styling';
import { reads } from 'macro-decorators';
import {
  CornerDotType,
  CornerSquareType,
  DotType,
} from 'qr-code-styling/lib/types';

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

class StyledQrCodeComponent extends Component<StyledQrCodeComponentArgs> {
  @reads('args.size', 300) declare size: number;
  @reads('args.backgroundColor', '#ffffff') declare backgroundColor: string;
  @reads('args.dotColor', '#000000') declare dotColor: string;
  @reads('args.dotType', 'square') declare dotType: DotType;
  @reads('args.margin', 0) declare margin: number;
  @reads('args.imageMargin', 0) declare imageMargin: number;
  qrCode: any;

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

  @action generateQrCode(element: HTMLElement) {
    this.qrCode = new QRCodeStyling(this.qrOptions);
    this.qrCode.append(element);
  }

  @action updateQrCode() {
    this.qrCode.update(this.qrOptions);
  }
}

export default StyledQrCodeComponent;
