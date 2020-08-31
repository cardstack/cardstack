export default [
    {
      id: 'bunny_records',
      type: 'label',
      title: 'Bunny Records',
      iconURL: "/media-registry/button-bunny-records.svg",
      logoURL: '/media-registry/bunny-logo.svg',
      user: {
        name: "Lisa Track",
        title: "Administrator",
        imgURL: "/media-registry/profiles/Lisa-Track.jpg",
        queueCards: [
          {
            id: "1",
            status: "open",
            title: "Catalog transfer",
            description: "Catalog transfer from Bunny Records to CRD Records for 16 masters",
            datetime: "2020-08-31T14:46",
            projectTitle: "Rights transfer, CRD Records",
            progressPct: 20
          },
          {
            id: "2",
            status: "needs-response",
            title: "Interesting band | Jelly Club",
            datetime: "2020-08-31T13:26",
            projectTitle: "Potential artist, Hard rock",
            progressPct: 40,
          },
          {
            id: "3",
            status: "needs-response",
            title: "Cover art | GG Greatest Hits",
            datetime: "2020-08-25T17:02",
            projectTitle: "New album, Golden Girl",
            progressPct: 40,
          },
          {
            id: "4",
            status: "closed",
            title: "Agreements | BB Clarke",
            datetime: "2020-08-20T15:11",
            projectTitle: "Rights transfer, CRD Records",
            progressPct: 100,
          },
          {
            id: "5",
            status: "closed",
            title: "Agreements | Pia Midina",
            datetime: "2020-07-31T11:40",
            projectTitle: "Rights transfer, CRD Records",
            progressPct: 100,
          },
          {
            id: "6",
            status: "recent",
            title: "Registration | GG Greatest Hits",
            datetime: "2020-07-30T09:22",
            projectTitle: " New album, Golden Girl",
            progressPct: 40,
          },
          {
            id: "7",
            status: "closed",
            title: "Request | Pia Midina",
            datetime: "2020-07-16T13:38",
            projectTitle: "Rights transfer, CRD Records",
            progressPct: 100,
          },
          {
            id: "8",
            status: "recent",
            title: "Tracks | GG Greatest Hits",
            datetime: "2020-07-15T12:21",
            projectTitle: " New album, Golden Girl",
            progressPct: 40
          }
        ]
      }
    },
    {
      id: 'crd_records',
      type: 'label',
      title: 'CRD Records',
      iconURL: "/media-registry/button-crd-records.svg",
      logoURL: '/media-registry/crd_records_logo.svg',
      user: {
        name: "Steve Rights",
        title: "Catalog Manager",
        imgURL: "/media-registry/profiles/Steve-Rights.jpg",
        queueCards: [
          {
            id: "1",
            status: "open",
            title: "Catalog transfer",
            description: "Catalog transfer from Bunny Records to CRD Records for 16 masters",
            datetime: "2020-08-31T14:56",
            projectTitle: "Rights transfer, Bunny Records",
            progressPct: 40
          },
          {
            id: "2",
            status: "needs-response",
            title: "Radio interview | FM8",
            datetime: "2020-08-25T11:00",
            projectTitle: "Interviews, CEO",
            progressPct: 20
          },
          {
            id: "3",
            status: "closed",
            title: "To Dos",
            datetime: "2020-08-13T10:10",
            projectTitle: "Rights transfer, Bunny Records",
            progressPct: 100
          },
          {
            id: "4",
            status: "recent",
            title: "TV interview | ZBZ",
            datetime: "2020-08-12T16:38",
            projectTitle: "Interviews, CEO",
            progressPct: 40
          },
          {
            id: "5",
            status: "recent",
            title: "Newspaper interview | New Times",
            datetime: "2020-07-29T17:01",
            projectTitle: "Interviews, CEO",
            progressPct: 40
          }
        ]
      }
    },
    {
      id: 'warner-music-group',
      type: 'label',
      title: 'Warner Music Group',
      iconURL: '/media-registry/wmg-logo.svg',
      logoURL: '/media-registry/wmg-logo.svg'
    },
    {
      id: 'allegro-music-publishing',
      type: 'publisher',
      title: 'Allegro Music Publishing',
      iconURL: '/media-registry/amp-logo.png',
      logoURL: '/media-registry/amp-logo.png',
      territory: 'worldwide',
      ipi: '00170191322',
      website: 'www.allegromusic.com',
      main_office: 'New York, USA',
      musicalWorkOnly: true
    },
    {
      id: 'warner-chappell-music',
      type: 'publisher',
      title: 'Warner Chappell Music',
      iconURL: '/media-registry/wcm-logo.png',
      logoURL: '/media-registry/wcm-logo.png',
      territory: 'worldwide',
      ipi: '00160187388',
      website: 'www.warnerchappell.com',
      main_office: 'Los Angeles, USA',
      musicalWorkOnly: true
    },
    {
      id: 'global-music-rights',
      title: 'Global Music Rights',
      iconURL: '/media-registry/gmr-logo.svg',
      logoURL: '/media-registry/gmr-logo.svg',
      musicalWorkOnly: true
    },
    {
      id: 'deezer',
      title: 'Deezer',
      iconURL: '/media-registry/deezer-logo.png',
      logoURL: '/media-registry/deezer-logo.png'
    },
  ];
