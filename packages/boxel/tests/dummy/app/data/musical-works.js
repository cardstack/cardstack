import { WCM, AMP, VALENTINO_PR, EMILIO_PR, MARIA_PR } from './comp-data';

// Profiles
const VALENTINO_SOLANO_V0 = {
  id: 'valentino-solano',
  type: 'participant',
  title: 'Valentino Solano',
  expandable: true,
};

const VALENTINO_SOLANO_V1 = {
  id: 'valentino-solano',
  type: 'participant',
  title: 'Valentino Solano',
  imgURL: VALENTINO_PR.writer.imgURL,
  ipi: '00815723492',
  pro: 'SOMOA',
  email: 'valentino@valsolanomusic.com',
  website: 'www.valsolanomusic.com',
  expandable: true,
};

// PR cards
const VALENTINO_PR_V0 = {
  id: 'valentino-solano-pr',
  version: '0',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO_V0,
  role: null,
  publisher: null,
  expandable: true,
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
    value: [WCM],
  },
  expandable: true,
};

export default [
  // WMG 1
  {
    id: 'the-sun-comes-out-wmg-v1',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'Warbler Music',
    ownerId: 'warbler-music',
    datetime: '2020-04-08T10:45',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR_V0],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0x2b4932f7c27d6ca5d8bd5601ba7c28071221165ac2f1b7928c22c2809d24183ca',
          verifi_id:
            '0x2b4932f7c27d6ca5d8bd5601ba7c28071221165ac2f1b7928c22c2809d24183ca',
          verifi_reg_date: '2020-04-08',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        value: null,
      },
      {
        title: 'ownership_splits',
        value: null,
      },
      {
        title: 'publishers',
        value: null,
      },
      {
        title: 'copyright_notice',
        value: null,
      },
    ],
  },
  // WMG 2
  {
    id: 'the-sun-comes-out-wmg-v2',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'Warbler Music',
    ownerId: 'warbler-music',
    datetime: '2019-11-11T13:54',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR_V1, EMILIO_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id:
            '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '50%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },
  // WMG 3
  {
    id: 'wmg-the-sun-comes-out',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'Warbler Music',
    ownerId: 'warbler-music',
    datetime: '2020-06-09T18:10',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR, EMILIO_PR, MARIA_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id:
            '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%',
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },

  // AMP
  {
    id: 'the-sun-comes-out-amp',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'Allegro Music Publishing',
    ownerId: 'allegro-music-publishing',
    iconURL: AMP.logoURL,
    datetime: '2020-05-18T11:36',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR_V1, EMILIO_PR, MARIA_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0x31ef32b4c27f6ca5d6bd6201fa7c14071228965dc2f1b4328c22e5609e8912ab4',
          verifi_id:
            '0x31ef32b4c27f6ca5d6bd6201fa7c14071228965dc2f1b4328c22e5609e8912ab4',
          verifi_reg_date: '2020-05-18',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%',
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },

  // WCM 1
  {
    id: 'the-sun-comes-out-wcm-v1',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'RealTunes Publishing',
    ownerId: 'realtunes-publishing',
    iconURL: WCM.logoURL,
    datetime: '2019-11-11T13:54',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR_V1, EMILIO_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id:
            '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '50%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },
  // WCM 2
  {
    id: 'the-sun-comes-out-wcm-v2',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'RealTunes Publishing',
    ownerId: 'realtunes-publishing',
    iconURL: WCM.logoURL,
    datetime: '2020-05-18T15:31',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR_V1, EMILIO_PR, MARIA_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id:
            '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%',
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },
  // WCM 3
  {
    id: 'wcm-the-sun-comes-out',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'RealTunes Publishing',
    ownerId: 'realtunes-publishing',
    iconURL: WCM.logoURL,
    datetime: '2020-06-09T18:10',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR, EMILIO_PR, MARIA_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id:
            '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%',
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },

  // GMR
  {
    id: 'the-sun-comes-out-gmr',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'SOMOA Music Rights',
    ownerId: 'somoa',
    datetime: '2020-06-09T16:18',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR, EMILIO_PR, MARIA_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0x7cf232e7c48d6ba5d8bd3101fc7a28071091165de2f1b4542c37e2812d89154be',
          verifi_id:
            '0x7cf232e7c48d6ba5d8bd3101fc7a28071091165de2f1b4542c37e2812d89154be',
          verifi_reg_date: '2020-06-09',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%',
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },

  // DSP 1
  {
    id: 'dsp-the-sun-comes-out',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'DSP',
    ownerId: 'dsp',
    datetime: '2020-07-10T14:24',
    isolatedFields: [
      {
        title: 'title',
        value: null,
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: null,
      },
      {
        title: 'iswc',
        value: null,
      },
      {
        title: 'verifi_id',
        value: null,
      },
      {
        title: 'version_type',
        value: null,
      },
      {
        title: 'ownership_splits',
        value: null,
      },
      {
        title: 'publishers',
        value: null,
      },
      {
        title: 'copyright_notice',
        value: null,
      },
    ],
  },
  // DSP 2
  {
    id: 'dzr-the-sun-comes-out',
    title: 'The Sun Comes Out',
    type: 'musical-work',
    owner: 'DSP',
    ownerId: 'dsp',
    datetime: '2020-06-09T18:10',
    isolatedFields: [
      {
        title: 'title',
        value: 'The Sun Comes Out',
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: [VALENTINO_PR, EMILIO_PR, MARIA_PR],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_id:
            '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
          verifi_reg_date: '2019-11-11',
          asset_type: 'Original work',
        },
      },
      {
        title: 'version_type',
        type: 'card',
        component: 'cards/file',
        value: {
          id: 'original-work',
          type: 'version-type',
          title: 'Original work',
        },
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: [
          {
            title: 'Valentino Solano (Lyricist)',
            value: '50%',
          },
          {
            title: 'Emilio Rosso (Composer)',
            value: '25%',
          },
          {
            title: 'Maria Bianchi (Composer)',
            value: '25%',
          },
        ],
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: {
          id: 'worldwide',
          title: 'Worldwide',
          type: 'territory',
          value: [WCM, AMP],
        },
      },
      {
        title: 'copyright_notice',
        value: [
          '© 2019 RealTunes Publishing',
          '© 2019 Allegro Music Publishing',
        ],
      },
    ],
  },
];
