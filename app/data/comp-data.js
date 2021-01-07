export const AMP = {
  id: 'allegro-music-publishing',
  type: 'publisher',
  title: 'Allegro Music Publishing',
  logoURL: '/boxel/media-registry/amp-logo.png',
  territory: 'worldwide',
  ipi: '00170191322',
  website: 'www.allegromusic.com',
  main_office: 'New York, USA'
};

export const WCM = {
  id: 'warner-chappell-music',
  type: 'publisher',
  title: 'Warner Chappell Music',
  logoURL: '/boxel/media-registry/wcm-logo.png',
  territory: 'worldwide',
  ipi: '00160187388',
  website: 'www.warnerchappell.com',
  main_office: 'Los Angeles, USA'
}

// WRITERS
// complete data
const VALENTINO_SOLANO = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano",
  "imgURL": "/boxel/media-registry/profiles/thumb/Valentino-Solano.jpg",
  "ipi": "00914256714",
  "pro": "Global Music Rights",
  "email": "valentino@valsolanomusic.com",
  "website": "www.valsolanomusic.com",
  "expandable": true
};

const EMILIO_ROSSO = {
  "id": "emilio-rosso",
  "type": "participant",
  "title": "Emilio Rosso",
  "imgURL": "/boxel/media-registry/profiles/thumb/Emilio-Rosso.jpg",
  "ipi": "00231925374",
  "pro": "Global Music Rights",
  "email": "emilio@rosso.com",
  "website": null,
  "expandable": true
};

const MARIA_BIANCHI = {
  "id": "maria-bianchi",
  "type": "participant",
  "title": "Maria Bianchi",
  "imgURL": "/boxel/media-registry/profiles/thumb/Maria-Bianchi.jpg",
  "ipi": "00181928972",
  "pro": "Global Music Rights",
  "email": "m.bianchi@gmail.com",
  "website": null,
  "expandable": true
};


// WRITER PUBLISHER REP CARDS
// complete data
export const VALENTINO_PR = {
  id: 'valentino-solano-pr',
  version: '2',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO,
  role: 'Lyricist',
  publisher: {
    id: 'worldwide',
    title: 'Worldwide',
    type: 'territory',
    value: [ WCM ],
    publishers: [ WCM ]
  },
  "expandable": true
};

export const EMILIO_PR = {
  id: 'emilio-rosso-pr',
  type: 'publishing-representation',
  writer: EMILIO_ROSSO,
  role: 'Composer',
  publisher: {
    id: 'worldwide',
    title: 'Worldwide',
    type: 'territory',
    value: [ AMP ],
    publishers: [ AMP ]
  },
  "expandable": true
}

export const MARIA_PR = {
  id: 'maria-bianchi-pr',
  type: 'publishing-representation',
  writer: MARIA_BIANCHI,
  role: 'Composer',
  publisher: {
    id: 'worldwide',
    title: 'Worldwide',
    type: 'territory',
    value: [ AMP ],
    publishers: [ AMP ]
  },
  "expandable": true
};


// MUSICAL WORK
export const MUSICAL_WORK = {
  "id": "the-sun-comes-out",
  "type": "musical-work",
  "title": "The Sun Comes Out",
  "writers": [ VALENTINO_SOLANO, EMILIO_ROSSO, MARIA_BIANCHI ],
  "iswc": "T-070237182-9",
  "version_type": "Original work",
  "publishers": [ WCM, AMP ],
  "copyright_notice": "© 2019 Warner Chappell Music, © 2019 Allegro Music Publishing"
};


// MASTER DETAIL
export const MASTER_DETAIL = {
  "title": "The Sun Comes Out",
  "artist": "Bella Swan",
  "album": "Love the Love",
  "cover_art": "/boxel/media-registry/covers/The-Sun-Comes-Out.jpg",
  "cover_art_thumb": "/boxel/media-registry/covers/thumb/The-Sun-Comes-Out.jpg",
  "cover_art_medium": "/boxel/media-registry/covers/medium/The-Sun-Comes-Out.jpg",
  "cover_art_large": "/boxel/media-registry/covers/large/The-Sun-Comes-Out.jpg",
  "type_of_album": "",
  "owner": "Warner Music Group",
  "label": ["Warner Music Group"],
  "genre": "Pop",
  "length": "2:58",
  "language": ["English (en_US)"],
  "year": "2020",
  "parental_advisory": "No",
  "recording_date": "2020-04-08",
  "original_release_date": "2020-01-28",
  "cover_art_date": "2020-04-08",
  "audio": [
    {
      title: "the-sun-comes-out.aiff",
      date: "2020-04-08",
    },
    {
      title: "the-sun-comes-out-watermarked.aiff",
      date: "2020-04-08",
    }
  ],
  "isrc": "US-S1Z-18-04923",
  "copyright_notice": "(P) 2020 Warner Music Group",
  "producer": "Anton Merano",
  "producer_id": "anton-merano",
  "mastering_engineer": "Lena Bosh",
  "mixing_engineer": "Jimmy Smith",
  "recording_engineer": "Lily Coleson"
};
