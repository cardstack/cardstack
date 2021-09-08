import {
  WCM,
  AMP,
  EMILIO_PR,
  MARIA_PR,
  valentinoSolanoThumb,
} from './comp-data';
import { ampLogo, realtunesLogo } from './organizations';

const VALENTINO_SOLANO_V1 = {
  id: 'valentino-solano',
  type: 'participant',
  title: 'Valentino Solano',
  imgURL: valentinoSolanoThumb,
  ipi: '00815723492',
  pro: 'SOMOA',
  email: 'valentino@valsolanomusic.com',
  website: 'www.valsolanomusic.com',
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
    publishers: [WCM],
  },
  expandable: true,
};

export default {
  id: 'the-sun-comes-out-wcm-amp',
  type: 'Musical Work',
  title: 'The Sun Comes Out',
  ownerId: 'realtunes-publishing',
  baseOwner: 'RealTunes Publishing',
  compOwner: 'Allegro Music Publishing',
  baseCard: {
    isPublisher: true,
    version: 'v2',
    id: 'the-sun-comes-out-wcm-v1',
    type: 'musical-work',
    owner: 'RealTunes Publishing',
    ownerId: 'realtunes-publishing',
    iconURL: realtunesLogo,
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
        value: [
          VALENTINO_PR_V1,
          EMILIO_PR,
          {
            id: 'maria-bianchi-pr',
            type: null,
            writer: null,
            role: null,
            publisher: null,
          },
        ],
      },
      {
        title: 'iswc',
        value: 'T-070237182-9',
      },
      {
        title: 'verifi_id',
        id: '0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
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
        title: 'publisher',
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
  compCard: {
    id: 'the-sun-comes-out-amp',
    type: 'musical-work',
    version: 'v3',
    owner: 'Allegro Music Publishing',
    ownerId: 'allegro-music-publishing',
    iconURL: ampLogo,
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
        title: 'publisher',
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
};
