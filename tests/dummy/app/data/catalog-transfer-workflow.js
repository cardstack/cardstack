import METADATASTEPS from './amend-metadata-steps';

export default [
  {
    pct: 0,
    iconLg: '/assets/images/icons/progress-circle-lg.svg',
    desc: 'Not Started'
  },
  {
    pct: 20,
    iconLg: '/media-registry/progress-pie/progress-20pct-lg.svg',
    desc: 'Proposal Submitted',
    timestamp: '2020-08-31T14:46'
  },
  {
    pct: 40,
    iconLg: '/media-registry/progress-pie/progress-40pct-lg.svg',
    desc: 'Reviewing Proposal',
    timestamp: '2020-08-31T14:56'
  },
  {
    pct: 60,
    iconLg: '/media-registry/progress-pie/progress-60pct-lg.svg',
    desc: 'Transfer Accepted',
    timestamp: METADATASTEPS[0].timestamp
  },
  {
    pct: 80,
    iconLg: '/media-registry/progress-pie/progress-80pct-lg.svg',
    desc: 'Metadata Amended',
    timestamp: METADATASTEPS[2].timestamp
  },
  {
    pct: 100,
    iconLg: '/media-registry/progress-pie/progress-100pct-lg.svg',
    desc: 'Transfer Completed',
    timestamp: '2020-09-01T09:51'
  }
];
