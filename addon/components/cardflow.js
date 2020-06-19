import Component from '@glimmer/component';

export default class CardflowComponent extends Component {
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
