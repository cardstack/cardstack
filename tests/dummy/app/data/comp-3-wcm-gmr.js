import { WCM, AMP, VALENTINO_PR_V1, VALENTINO_PR, EMILIO_PR, MARIA_PR, MUSICAL_WORK_WCM_V2, MUSICAL_WORK_GMR } from "./comp-data";

export default {
  id: "the-sun-comes-out-wcm-gmr",
  type: "Musical Work",
  title: "The Sun Comes Out",
  baseOwner: 'Warner Chappell Music',
  compOwner: 'Global Music Rights',
  baseCard: {
    card: MUSICAL_WORK_WCM_V2,
    type: 'musical-work',
    owner: 'Warner Chappell Music',
    ownerId: 'wcm',
    iconURL: '/media-registry/wcm-logo.png',
    datetime: '2020-05-18T15:31',
    id: MUSICAL_WORK_WCM_V2.id,
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
          VALENTINO_PR_V1,
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
        id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
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
        type: 'collection',
        component: 'cards/territory',
        value: [
          {
            id: 'worldwide',
            title: 'Worldwide',
            type: 'territory',
            value: [ WCM, AMP ],
            publishers: [ WCM, AMP ]
          }
        ]
      },
      {
        title: 'copyright_notice',
        value: ['© 2019 Warner Chappell Music', '© 2019 Allegro Music Publishing']
      }
    ]
  },
  compCard: {
    card: MUSICAL_WORK_GMR,
    type: 'musical-work',
    owner: 'Global Music Rights',
    ownerId: 'gmr',
    iconURL: '/media-registry/gmr-logo.svg',
    datetime: '2020-06-09T16:18',
    id: MUSICAL_WORK_GMR.id,
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
        id: '0x7cf232e7c48d6ba5d8bd3101fc7a28071091165de2f1b4542c37e2812d89154be',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          verifi_id: '0x7cf232e7c48d6ba5d8bd3101fc7a28071091165de2f1b4542c37e2812d89154be',
          verifi_reg_date: '2020-06-09',
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
        type: 'collection',
        component: 'cards/territory',
        value: [
          {
            id: 'worldwide',
            title: 'Worldwide',
            type: 'territory',
            value: [ WCM, AMP ],
            publishers: [ WCM, AMP ]
          }
        ]
      },
      {
        title: 'copyright_notice',
        value: ['© 2019 Warner Chappell Music', '© 2019 Allegro Music Publishing']
      }
    ]
  }
}
