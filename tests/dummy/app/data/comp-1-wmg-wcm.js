
import { WCM, AMP, VALENTINO_PR, EMILIO_PR } from "./comp-data";

const VALENTINO_SOLANO_MISSING = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano"
};

const VALENTINO_PR_MISSING = {
  id: 'valentino-solano-pr',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO_MISSING,
  role: 'Lyricist',
  publisher: {
    title: 'publisher',
    value: [
      {
        title: 'Worldwide',
        type: 'collection',
        value: [ WCM ]
      }
    ]
  }
};

export default {
  id: "mw-the-sun-comes-out-wmg-wcm",
  baseCard: {
    type: 'musical-work',
    owner: 'Warner Music Group',
    ownerId: 'wmg',
    iconURL: '/media-registry/wmg-logo.svg',
    datetime: '2020-04-08T10:45',
    id: 'wmg-the-sun-comes-out',
    itemId: 'wmg-the-sun-comes-out',
    title: 'The Sun Comes Out',
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
          VALENTINO_PR_MISSING
        ]
      },
      {
        title: 'iswc',
        value: "T-070237182-9"
      },
      {
        title: 'verifi_id',
        id: '0x2b4932f7c27d6ca5d8bd5601ba7c28071221165ac2f1b7928c22c2809d24183ca',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          verifi_id: '0x2b4932f7c27d6ca5d8bd5601ba7c28071221165ac2f1b7928c22c2809d24183ca',
          verifi_reg_date: '2020-04-08',
          asset_type: 'Original work'
        }
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
    owner: 'Warner Chappell Music',
    ownerId: 'wcm',
    iconURL: '/media-registry/wcm-logo.png',
    datetime: '2019-11-11T13:54',
    id: 'wcm-the-sun-comes-out',
    itemId: 'wcm-the-sun-comes-out',
    title: 'The Sun Comes Out',
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
  }
}
