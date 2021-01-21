import METADATASTEPS from './amend-metadata-steps';

import ProgCircle0Lg from '@cardstack/boxel/images/icons/progress-circle-lg.svg'
import ProgCircle20Lg from '@cardstack/boxel/images/media-registry/progress-pie/progress-20pct-lg.svg'
import ProgCircle40Lg from '@cardstack/boxel/images/media-registry/progress-pie/progress-40pct-lg.svg'
import ProgCircle60Lg from '@cardstack/boxel/images/media-registry/progress-pie/progress-60pct-lg.svg'
import ProgCircle80Lg from '@cardstack/boxel/images/media-registry/progress-pie/progress-80pct-lg.svg'
import ProgCircle100Lg from '@cardstack/boxel/images/media-registry/progress-pie/progress-100pct-lg.svg'

export default [
  {
    pct: 0,
    iconLg: ProgCircle0Lg,
    desc: 'Not Started'
  },
  {
    pct: 20,
    iconLg: ProgCircle20Lg,
    desc: 'Proposal Submitted',
    timestamp: '2020-08-31T14:46'
  },
  {
    pct: 40,
    iconLg: ProgCircle40Lg,
    desc: 'Reviewing Proposal',
    timestamp: '2020-08-31T14:56'
  },
  {
    pct: 60,
    iconLg: ProgCircle60Lg,
    desc: 'Transfer Accepted',
    timestamp: METADATASTEPS[0].timestamp
  },
  {
    pct: 80,
    iconLg: ProgCircle80Lg,
    desc: 'Metadata Amended',
    timestamp: METADATASTEPS[2].timestamp
  },
  {
    pct: 100,
    iconLg: ProgCircle100Lg,
    desc: 'Transfer Completed',
    timestamp: '2020-09-01T09:51'
  }
];
