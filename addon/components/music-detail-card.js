import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { truncateVerifiId } from '@cardstack/boxel/utils/truncate-verifi-id';
import { titleize } from '@cardstack/boxel/utils/titleize';
import { formatId } from '@cardstack/boxel/utils/format-id';

export default class MusicDetailCardComponent extends Component {
  @tracked model = this.args.model;

  get headerDetailFields() {
    if (!this.model) { return null; }
    return [
      {
        title: 'isrc',
        value: this.model.isrc
      },
      {
        title: 'verifi id',
        value: truncateVerifiId(this.model.verifi_id)
      },
      {
        title: 'label',
        value: this.model.label
      },
    ];
  }

  get detailSections() {
    if (this.args.noTemplate) {
      if (!this.args.fields) { return []; }
      return [{ content: this.args.fields }];
    }

    return [
      {
        title: "Master Details",
        content: this.recordingDetails
      },
      {
        title: "Musical Work",
        content: [ this.musicalWork ]
      },
      {
        title: "Registrations",
        content: [ this.verifiRegistration ]
      },
      {
        title: "Files",
        content: this.files
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
    if (!this.model) { return null; }
    return [
      {
        title: 'title',
        value: titleize(this.model.title)
      },
      {
        title: 'main artist',
        value: this.model.artists || [{ type: 'participant', title: this.model.artist }],
        type: 'collection',
        component: 'cards/artist',
        search: (q) => (this.model.selectableArtists || []).filter(a => a.title.toLowerCase().includes(q.toLowerCase()))
      },
      {
        title: 'label',
        value: this.model.label
      },
      {
        title: 'genre',
        value: [ this.model.genre ]
      },
      {
        title: 'duration',
        value: this.model.length
      },
      {
        title: 'language',
        value: this.model.language
      },
      {
        title: 'recording year',
        value: Number(this.model.year) || null,
        type: 'dropdown',
        options: [
          { value: 2018 },
          { value: 2019 },
          { value: 2020 }
        ]
      },
      {
        title: 'release date',
        value: this.model.original_release_date,
        type: 'date'
      },
      {
        title: 'recording session date',
        value: this.model.recording_date,
        type: 'date'
      },
      {
        title: 'parental advisory',
        value: this.model.parental_advisory,
        type: 'dropdown',
        options: [
          { value: "Yes" },
          { value: "No" }
        ]
      },
      {
        title: 'copyright notice',
        value: this.model.copyright_notice
      }
    ];
  }

  get musicalWork() {
    if (!this.model) { return null; }
    return {
      id: this.model.iswc_id,
      type: 'card',
      component: 'cards/musical-work-embedded',
      title: 'Musical Work',
      value: this.model.musicalWork,
      search: (q) => (this.model.selectableWorks || []).filter(a => a.title.toLowerCase().includes(q.toLowerCase()))
    }
  }

  get verifiRegistration() {
    if (!this.model) { return null; }
    let title = 'Verifi Registry';
    let verifi_id = this.model.verifi_id;
    if (!verifi_id) { return { title, type: 'card' }; }
    return {
      type: 'card',
      component: 'cards/registration-embedded',
      title,
      value: { id: verifi_id, verifi_id, verifi_reg_date: this.model.verifi_reg_date }
    }
  }

  get codes() {
    if (!this.model) { return null; }
    return [
      {
        title: 'isrc',
        value: [
          {
            title: 'Primary',
            value: this.model.isrc
          },
          {
            title: 'Secondary',
            value: this.model.isrc_secondary
          }
        ]
      },
      {
        title: 'catalog number',
        value: this.model.catalog_no
      },
    ];
  }

  get credits() {
    if (!this.model) { return null; }
    return [
      {
        title: 'main artist',
        value: this.model.artists || [{ type: 'participant', title: this.model.artist }],
        type: 'collection',
        component: 'cards/artist',
        search: (q) => (this.model.selectableArtists || []).filter(a => a.title.toLowerCase().includes(q.toLowerCase()))
      },
      {
        title: 'producer',
        value: this.model.producers,
        type: 'collection',
        component: 'cards/artist',
        search: (q) => (this.model.selectableArtists || []).filter(a => a.title.toLowerCase().includes(q.toLowerCase()))
      },
      {
        title: 'mastering engineer',
        value: this.model.mastering_engineer
      },
      {
        title: 'mixing engineer',
        value: this.model.mixing_engineer
      },
      {
        title: 'recording engineer',
        value: this.model.recording_engineer
      },
      {
        title: 'background singer',
        value: this.model.background_singer
      },
    ];
  }

  get files() {
    if (!this.model) { return null; }
    return [
      {
        title: 'cover art',
        format: 'grid',
        type: 'card', // field type
        component: 'cards/file',
        value: {
          id: formatId(this.model.album),
          type: 'image', // card type
          title: titleize(this.model.album),
          imgURL: this.model.cover_art_thumb,
          createdDate: this.model.cover_art_date
        }
      },
      {
        title: 'audio',
        type: 'collection', // field type
        component: 'cards/audio',
        value: [
          {
            id: `${this.model.id}.flac`,
            type: 'audio', // card type
            title: `${this.model.id}.flac`
          },
          {
            id: `${this.model.id}-watermarked.flac`,
            type: 'audio',
            title: `${this.model.id}-watermarked.flac`
          }
        ]
      }
    ];
  }
}
