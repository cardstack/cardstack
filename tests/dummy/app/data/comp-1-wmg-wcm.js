
import { WCM, AMP, EMILIO_PR, MUSICAL_WORK_WMG_V1, MUSICAL_WORK_WCM_V1 } from "./comp-data";

const VALENTINO_SOLANO_V0 = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano",
  "expandable": true
};

const VALENTINO_PR_V0 = {
  id: 'valentino-solano-pr',
  version: '0',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO_V0,
  role: null,
  publisher: null,
  "expandable": true
};

const VALENTINO_SOLANO_V1 = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano",
  "imgURL": "/media-registry/profiles/thumb/Valentino-Solano.jpg",
  "ipi": "00815723492",
  "pro": "Global Music Rights",
  "email": "valentino@valsolanomusic.com",
  "website": "www.valsolanomusic.com",
  "expandable": true
};

const VALENTINO_PR_V1 = {
  id: 'valentino-solano-pr',
  version: '1',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO_V1,
  role: 'Lyricist',
  publisher: {
    id: 'worldwide',
    title: 'Worldwide',
    type: 'territory',
    value: [ WCM ]
  },
  "expandable": true
};

export default {
  id: "the-sun-comes-out-wmg-wcm",
  type: "Musical Work",
  title: "The Sun Comes Out",
  baseOwner: 'Warner Music Group',
  compOwner: 'Warner Chappell Music',
  baseCard: {
    card: MUSICAL_WORK_WMG_V1,
    type: 'musical-work',
    owner: 'Warner Music Group',
    ownerId: 'wmg',
    iconURL: '/media-registry/wmg-logo.svg',
    datetime: '2020-04-08T10:45',
    id: MUSICAL_WORK_WMG_V1.id,
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
          VALENTINO_PR_V0,
          {
            id: 'emilio-rosso-pr',
            type: null,
            writer: null,
            role: null,
            publisher: null
          }
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
          id: '0x2b4932f7c27d6ca5d8bd5601ba7c28071221165ac2f1b7928c22c2809d24183ca',
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
        title: 'publishers',
        value: null
      },
      {
        title: 'copyright_notice',
        value: null
      }
    ]
  },
  compCard: {
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
              value: '50%'
            }
          ]
      },
      {
        title: 'publishers',
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
