import { WCM, AMP, VALENTINO_PR_V1, EMILIO_PR, MARIA_PR, MUSICAL_WORK_WCM_V1, MUSICAL_WORK_AMP_V1 } from "./comp-data";

export default {
  id: "the-sun-comes-out-wcm-amp",
  type: "Musical Work",
  title: "The Sun Comes Out",
  baseOwner: 'Warner Chappell Music',
  compOwner: 'Allegro Music Publishing',
  baseCard: {
    card: MUSICAL_WORK_WCM_V1,
    type: 'musical-work',
    owner: 'Warner Chappell Music',
    ownerId: 'wcm',
    iconURL: '/media-registry/wcm-logo.png',
    datetime: '2019-11-11T13:54',
    id: MUSICAL_WORK_WCM_V1.id,
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
          EMILIO_PR
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
            value: '50%'
          }
        ]
      },
      {
        title: 'publisher',
        type: 'territory',
        value: [
          {
            title: 'Worldwide',
            type: 'collection',
            value: [ WCM, AMP ]
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
    card: MUSICAL_WORK_AMP_V1,
    type: 'musical-work',
    owner: 'Allegro Music Publishing',
    ownerId: 'amp',
    iconURL: '/media-registry/amp-logo.png',
    datetime: '2020-05-18T11:36',
    id: MUSICAL_WORK_AMP_V1.id,
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
        id: '0x31ef32b4c27f6ca5d6bd6201fa7c14071228965dc2f1b4328c22e5609e8912ab4',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          verifi_id: '0x31ef32b4c27f6ca5d6bd6201fa7c14071228965dc2f1b4328c22e5609e8912ab4',
          verifi_reg_date: '2020-05-18',
          asset_type: 'Original work'
        }
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
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
        type: 'territory',
        value: [
          {
            title: 'Worldwide',
            type: 'collection',
            value: [
              WCM,
              AMP
            ]
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
