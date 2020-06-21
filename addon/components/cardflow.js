import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class CardflowComponent extends Component {
  @tracked project = this.args.model?.user?.queueCards[0];

  get progress() {
    switch(this.project.progressPct) {
      case (20):
        return {
          pct: this.project.progressPct,
          iconLg: '/media-registry/progress-pie/progress-20pct-lg.svg',
          desc: 'Proposal Submitted'
        }
      case (40):
        return {
          pct: this.project.progressPct,
          iconLg: '/media-registry/progress-pie/progress-40pct-lg.svg',
          desc: 'Reviewing Proposal'
        }
      case (60):
        return {
          pct: this.project.progressPct,
          iconLg: '/media-registry/progress-pie/progress-60pct-lg.svg',
          desc: 'Transfer Accepted'
        }
      case (80):
        return {
          pct: this.project.progressPct,
          iconLg: '/media-registry/progress-pie/progress-80pct-lg.svg',
          desc: 'Metadata Amended'
        }
        case (100):
          return {
            pct: this.project.progressPct,
            iconLg: '/media-registry/progress-pie/progress-100pct-lg.svg',
            desc: 'Transfer Completed'
          }
      default:
        return {
          pct: 0,
          iconLg: '/assets/images/icons/progress-circle-lg.svg',
          desc: 'Not Started'
        }
    }
  }

  catalog = {
    title: 'Catalog',
    type: 'card',
    format: 'grid',
    component: 'cards/collection',
    value: {
      id: 'catalog-card',
      type: 'catalog',
      title: 'Batch F',
      catalog_title: 'Batch F',
      catalog_description: 'Transfer to CRD Records',
      number_of_songs: 16,
      selected_art: [
        "media-registry/covers/thumb/Sunlight.jpg",
        "media-registry/covers/thumb/Change-Is-Good.jpg",
        "media-registry/covers/thumb/Full-Moon.jpg",
        "media-registry/covers/thumb/Love-Never-Dies.jpg",
        "media-registry/covers/thumb/Animals.jpg"
      ]
    }
  }
}
