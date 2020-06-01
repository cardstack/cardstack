import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { dasherize } from '@ember/string';

export default class MediaDetailComponent extends Component {
  @tracked model = this.args.model;
  @tracked isEditMode = this.args?.mode === 'edit';

  cardId = function(field) {
    return String(dasherize(field.trim()));
  }

  get detailSections() {
    return [
      {
        title: "Recording Details",
        content: this.recordingDetails
      },
      {
        title: "Musical Work",
        content: [ this.musicalWork ]
      },
      {
        title: "Registrations",
        content: [ this.verifiRegistration, this.congressRegistration ]
      },
      {
        title: "Key Dates",
        content: this.keyDates
      },
      {
        title: "Files",
        content: this.files
      },
      {
        title: "Agreements",
        content: this.agreements
      },
      {
        title: "Codes",
        content: this.codes
      },
      {
        title: "Credits",
        content: this.credits
      },
    ];
  }

  get recordingDetails() {
    return [
      {
        title: 'title',
        value: this.model.song_title
      },
      {
        title: 'writer',
        value: [ this.model.artist_info || this.model.artist ]
      },
      {
        title: 'label',
        value: [ this.model.owner ]
      },
      {
        title: 'genre',
        value: this.model?.details?.genre || this.model.genre
      },
      {
        title: 'duration',
        value: this.model.length
      },
      {
        title: 'language performance',
        value: this.model?.details?.language
      },
      {
        title: 'recording year',
        value: this.model?.details?.year,
        type: 'dropdown',
        options: [
          { value: 2019 },
          { value: 2020 }
        ]
      },
      {
        title: 'parental advisory',
        value: this.model?.details?.parental_advisory,
        type: 'dropdown',
        options: [
          { value: "N/A" },
          { value: "Yes" },
          { value: "No" }
        ]
      },
      {
        title: 'copyright notice',
        value: this.model?.details?.copyright_notice
      }
    ];
  }

  get musicalWork() {
    return {
      id: this.model?.details?.iswc_id,
      type: 'card',
      component: 'cards/musical-work-embedded',
      title: 'Musical Work',
      value: this.model?.musicalWork
    }
  }

  get verifiRegistration() {
    let title = 'Verifi Registry';
    let verifi_id = this.model?.details?.verifi_id;
    if (!verifi_id) { return { title, type: 'card' }; }
    return {
      id: verifi_id,
      type: 'card',
      component: 'cards/registration-embedded',
      title,
      value: { verifi_id }
    }
  }

  get congressRegistration() {
    let title = 'Library of Congress';
    let congress_id = this.model?.details?.congress_id;
    if (!congress_id) { return { title, type: 'card' }; }
    return {
      id: congress_id,
      type: 'card',
      component: 'cards/registration-embedded',
      title,
      value: { congress_id, song_title: this.model.song_title }
    }
  }

  keyDates = [
    {
      title: 'recording session date',
      value: this.model?.details?.recording_date,
      type: 'date'
    },
    {
      title: 'original release date',
      value: this.model?.details?.original_release_date,
      type: 'date'
    }
  ];

  codes = [
    {
      title: 'isrc',
      value: [
        {
          title: 'Primary',
          value: this.model?.details?.isrc
        },
        {
          title: 'Secondary',
          value: []
        }
      ]
    },
    {
      title: 'catalog number',
      value: this.model?.details?.catalog_no
    },
  ];

  credits = [
    {
      title: 'main artist',
      value: [ this.model.artist_info || this.model.artist ]
    },
    {
      title: 'producer',
      value: this.model?.producer,
      type: 'card'
    },
    {
      title: 'mastering engineer',
      value: this.model?.details?.mastering_engineer
    },
    {
      title: 'mixing engineer',
      value: this.model?.details?.mixing_engineer
    },
    {
      title: 'recording engineer',
      value: this.model?.details?.recording_engineer
    },
    {
      title: 'background singer',
      value: this.model?.details?.background_singer
    },
  ];



  // Hardcoded sections

  coverArtCard = {
    id: this.cardId(this.model.album),
    type: 'file',
    category: 'cover-art',
    fields: {
      title: this.model.album,
      imgURL: this.model.cover_art,
      date: '2019-02-19'
    },
  }

  bookletCards = [
    {
      id: `${this.cardId(this.model.song_title)}.pdf`,
      type: 'file',
      category: 'booklet',
      fields: {
        title: `${this.cardId(this.model.song_title)}.pdf`,
        imgURL: this.model.cover_art,
        date: '2019-02-19'
      }
    },
    {
      id: `${this.cardId(this.model.song_title)}-translated.pdf`,
      type: 'file',
      category: 'booklet',
      fields: {
        title: `${this.cardId(this.model.song_title)}-translated.pdf`,
        imgURL: this.model.cover_art,
        date: '2019-02-19'
      }
    }
  ]

  audioFileCards = [
    {
      id: `${this.cardId(this.model.song_title)}.aiff`,
      type: 'file',
      category: 'audio-file',
      fields: {
        title: `${this.cardId(this.model.song_title)}.aiff`,
        imgURL: '/media-registry/file.svg',
        date: '2019-04-23'
      }
    },
    {
      id: `${this.cardId(this.model.song_title)}-watermarked.aiff`,
      type: 'file',
      category: 'audio-file',
      fields: {
        title: `${this.cardId(this.model.song_title)}-watermarked.aiff`,
        imgURL: '/media-registry/file.svg',
        date: '2019-04-23'
      }
    }
  ]

  get files() {
    return [
      {
        title: 'cover art',
        format: 'grid',
        type: 'card',
        value: this.coverArtCard
      },
      {
        title: 'booklet',
        format: 'grid',
        type: 'collection',
        value: this.bookletCards
      },
      {
        title: 'files',
        type: 'collection',
        value: this.audioFileCards
      }
    ];
  }

  get agreements() {

    let searchResults = [{
      id: 'exclusive-recording-agreement-2',
      type: 'agreement',
      imgURL: '/media-registry/bunny-records-logo.svg',
      title: 'Second Recording Agreement',
      fields: [
        {
          title: 'assigner',
          value: `${this.model.artist} (Ref)`
        },
        {
          title: 'assignee',
          value: `${this.model.owner} (Ref)`
        },
        {
          title: 'active through',
          value: 'Dec 2024'
        }
      ],
    }];
    return [
      {
        title: 'active',
        search: async function() {
          return searchResults;
        },
        value: [{
          id: 'exclusive-recording-agreement',
          type: 'agreement',
          imgURL: '/media-registry/bunny-records-logo.svg',
          title: 'Exclusive Recording Agreement',
          fields: [
            {
              title: 'assigner',
              value: `${this.model.artist} (Ref)`
            },
            {
              title: 'assignee',
              value: `${this.model.owner} (Ref)`
            },
            {
              title: 'active through',
              value: 'Dec 2023'
            }
          ],
        }
        ]
      },
    ];
  }
}
