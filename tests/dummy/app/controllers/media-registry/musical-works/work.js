import Controller from '@ember/controller';

export default class MediaRegistryMusicalWorksWorkController extends Controller {
  get headerFields() {
    if (!this.model) { return null; }
    return {
      image: '/media-registry/musical-work.svg',
      title: this.model.title,
      description: this.model.description ? `by ${this.model.description}` : null
    }
  }
}
