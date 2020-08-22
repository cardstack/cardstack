import { WCM, AMP, VALENTINO_PR, EMILIO_PR, MARIA_PR } from "./comp-data";

export default {
  id: "the-sun-comes-out-dzr-wmg",
  type: "Musical Work",
  title: "The Sun Comes Out",
  baseOwner: 'Deezer',
  compOwner: 'Warner Music Group',
  baseCard: {
    type: 'musical-work',
    owner: 'Deezer',
    ownerId: 'dzr',
    iconURL: '/media-registry/deezer-logo.png',
    datetime: '2020-07-10T14:24',
    id: 'dsp-the-sun-comes-out',
    isolatedFields: [
      {
        title: 'title',
        value: null
      },
      {
        title: "writers",
        type: "collection",
        component: "cards/publishing-representation",
        value: [
          {
            id: 'valentino-solano-pr',
            type: null,
            writer: null,
            role: null,
            publisher: null
          },
          {
            id: 'emilio-rosso-pr',
            type: null,
            writer: null,
            role: null,
            publisher: null
          },
          {
            id: 'maria-bianchi-pr',
            type: null,
            writer: null,
            role: null,
            publisher: null
          }
        ]
      },
      {
        title: 'iswc',
        value: null
      },
      {
        title: 'verifi_id',
        value: null
      },
      {
        title: 'version_type',
        value: null
      },
      {
        title: 'ownership_splits',
        value: null
      },
      {
        title: 'publisher',
        value: null
      },
      {
        title: 'copyright_notice',
        value: null
      }
    ]
  },
  compCard: {
    type: 'musical-work',
    owner: 'Warner Music Group',
    ownerId: 'wmg',
    iconURL: '/media-registry/wmg-logo.svg',
    datetime: '2020-06-09T18:10',
    id: 'wmg-the-sun-comes-out',
    isolatedFields: [
      {
        title: "title",
        value: "The Sun Comes Out"
      },
      {
        title: "writers",
        type: "collection",
        component: "cards/publishing-representation",
        value: [
          VALENTINO_PR,
          EMILIO_PR,
          MARIA_PR
        ]
      },
      {
        title: 'iswc',
        value: "T-070237182-9"
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work'
        }
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work'
        }
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%'
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%'
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%'
          }
        ]
      },
      {
        title: 'publisher',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [ WCM, AMP ]
        }
      },
      {
        title: 'copyright_notice',
        value: ['© 2019 Warner Chappell Music', '© 2019 Allegro Music Publishing']
      }
    ]
  }
}
