import { WCM, AMP, VALENTINO_PR, EMILIO_PR, MARIA_PR } from "./comp-data";

const VALENTINO_SOLANO_WRONG = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano",
  "description": "Lyricist",
  "imgURL": "/media-registry/profiles/thumb/Valentino-Solano.jpg",
  "ipi": "00914256714",
  "pro": "Global Music Rights",
  "email": "valentino@valsolanomusic.com",
  "website": "www.valsolanomusic.com"
};

export default {
  id: "the-sun-comes-out-wcm-gmr",
  baseCard: {
    type: 'musical-work',
    owner: 'Warner Chappell Music',
    ownerId: 'wcm',
    iconURL: '/media-registry/wcm-logo.png',
    datetime: '2020-05-18T15:31',
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
  },
  compCard: {
    type: 'musical-work',
    owner: 'Global Music Rights',
    ownerId: 'gmr',
    iconURL: '/media-registry/gmr-logo.svg',
    datetime: '2020-06-09T16:18',
    id: 'gmr-the-sun-comes-out',
    itemId: 'gmr-the-sun-comes-out',
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
          {
            id: 'valentino-solano-pr',
            type: 'publishing-representation',
            writer: VALENTINO_SOLANO_WRONG,
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
          },
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
