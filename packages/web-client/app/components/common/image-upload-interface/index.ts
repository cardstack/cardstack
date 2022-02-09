import Component from '@glimmer/component';

export const IMAGE_UPLOADER_STATES = {
  loading: 'loading',
  error: 'error',
  default: 'default',
} as const;

export default class ImageUploaderInterfaceComponent extends Component {
  states = IMAGE_UPLOADER_STATES;
}
