// ORGS
const WMG = {
  "id": "wmg",
  "type": "label",
  "title": "Warner Music Group",
  "imgURL": '/media-registry/wmg-logo.svg',
};

const GMR = {
  "id": "gmr",
  "type": "pro",
  "title": "Global Music Rights",
  "imgURL": '/media-registry/gmr-logo.svg',
};

export const AMP = {
  id: 'amp',
  type: 'publisher',
  title: 'Allegro Music Publishing',
  territory: 'worldwide',
  fields: [
    {
      title: 'IPI #',
      value: '00170191322'
    },
    {
      title: 'website',
      value: 'www.allegromusic.com'
    },
    {
      title: 'main office',
      value: 'New York, USA'
    }
  ]
};

export const WCM = {
  id: 'wcm',
  type: 'publisher',
  title: 'Warner Chappell Music',
  imgURL: '/media-registry/wcm-logo.png',
  territory: 'worldwide',
  fields: [
    {
      title: 'IPI #',
      value: '00160187388'
    },
    {
      title: 'website',
      value: 'www.warnerchappell.com'
    },
    {
      title: 'main office',
      value: 'Los Angeles, USA'
    }
  ]
}

// WRITERS
export const VALENTINO_SOLANO_V0 = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano"
};

export const VALENTINO_SOLANO_V1 = {
  "id": "valentino-solano",
  "type": "participant",
  "title": "Valentino Solano",
  "description": "Lyricist",
  "imgURL": "/media-registry/profiles/thumb/Valentino-Solano.jpg",
  "ipi": "00815723492",
  "pro": "Global Music Rights",
  "email": "valentino@valsolanomusic.com",
  "website": "www.valsolanomusic.com"
};

// complete info
export const VALENTINO_SOLANO = {
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

const EMILIO_ROSSO = {
  "id": "emilio-rosso",
  "type": "participant",
  "title": "Emilio Rosso",
  "description": "Composer",
  "imgURL": "/media-registry/profiles/thumb/Emilio-Rosso.jpg",
  "ipi": "00231925374",
  "pro": "Global Music Rights",
  "email": "emilio@rosso.com",
  "website": null
};

const MARIA_BIANCHI = {
  "id": "maria-bianchi",
  "type": "participant",
  "title": "Maria Bianchi",
  "description": "Composer",
  "imgURL": "/media-registry/profiles/thumb/Maria-Bianchi.jpg",
  "ipi": "00181928972",
  "pro": "Global Music Rights",
  "email": "m.bianchi@gmail.com",
  "website": null
};


// WRITER PUBLISHER REP CARDS
export const VALENTINO_PR_V0 = {
  id: 'valentino-solano-pr',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO_V0,
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

export const VALENTINO_PR_V1 = {
  id: 'valentino-solano-pr',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO_V1,
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

// complete version
export const VALENTINO_PR = {
  id: 'valentino-solano-pr',
  type: 'publishing-representation',
  writer: VALENTINO_SOLANO,
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

export const EMILIO_PR = {
  id: 'emilio-rosso-pr',
  type: 'publishing-representation',
  writer: EMILIO_ROSSO,
  role: 'Composer',
  publisher: {
    title: 'publisher',
    value: [
      {
        title: 'Worldwide',
        type: 'collection',
        value: [ AMP ]
      }
    ]
  }
}

export const MARIA_PR = {
  id: 'maria-bianchi-pr',
  type: 'publishing-representation',
  writer: MARIA_BIANCHI,
  role: 'Composer',
  publisher: {
    title: 'publisher',
    value: [
      {
        title: 'Worldwide',
        type: 'collection',
        value: [ AMP ]
      }
    ]
  }
};


// MUSICAL WORKS
export const MUSICAL_WORK_WMG_V1 = {
  "id": "the-sun-comes-out-wmg-v1",
  "type": "musical-work",
  "title": "The Sun Comes Out",
  "last_updated": "2020-04-08T10:45",
  "owner": WMG,
  "writers": [ VALENTINO_SOLANO_V0 ],
  "iswc": "T-070237182-9",
  "verifi_id": "0x2b4932f7c27d6ca5d8bd5601ba7c28071221165ac2f1b7928c22c2809d24183ca"
};

export const MUSICAL_WORK_WCM_V1 = {
  "id": "the-sun-comes-out-wcm-v1",
  "type": "musical-work",
  "last_updated": "2019-11-11T13:54",
  "title": "The Sun Comes Out",
  "owner": WCM,
  "writers": [ VALENTINO_SOLANO_V1, EMILIO_ROSSO ],
  "iswc": "T-070237182-9",
  "wcm_code": "WW013617780100",
  "verifi_id": "0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce",
  "version_type": "Original work",
  "publishers": [ WCM, AMP ],
  "copyright_notice": "© 2019 Warner Chappell Music, © 2019 Allegro Music Publishing"
};

export const MUSICAL_WORK_WCM_V2 = {
  "id": "the-sun-comes-out-wcm-v2",
  "type": "musical-work",
  "last_updated": "2020-05-18T15:31",
  "title": "The Sun Comes Out",
  "owner": WCM,
  "writers": [ VALENTINO_SOLANO_V1, EMILIO_ROSSO, MARIA_BIANCHI ],
  "iswc": "T-070237182-9",
  "wcm_code": "WW013617780100",
  "verifi_id": "0xab5332b7a35d6ca5d8bd3781fb7c28071341127dc2f1b6928c38e2809e89179ce",
  "version_type": "Original work",
  "publishers": [ WCM, AMP ],
  "copyright_notice": "© 2019 Warner Chappell Music, © 2019 Allegro Music Publishing"
};

export const MUSICAL_WORK_AMP_V1 = {
  "id": "the-sun-comes-out-amp",
  "type": "musical-work",
  "last_updated": "2020-05-18T11:36",
  "title": "The Sun Comes Out",
  "owner": AMP,
  "writers": [ VALENTINO_SOLANO_V1, EMILIO_ROSSO, MARIA_BIANCHI ],
  "iswc": "T-070237182-9",
  "verifi_id": "0x31ef32b4c27f6ca5d6bd6201fa7c14071228965dc2f1b4328c22e5609e8912ab4",
  "version_type": "Original work",
  "publishers": [ WCM, AMP ],
  "copyright_notice": "© 2019 Warner Chappell Music, © 2019 Allegro Music Publishing"
};

export const MUSICAL_WORK_GMR = {
  "id": "the-sun-comes-out-gmr",
  "type": "musical-work",
  "last_updated": "2020-06-09T16:18",
  "title": "The Sun Comes Out",
  "owner": GMR,
  "writers": [ VALENTINO_SOLANO, EMILIO_ROSSO, MARIA_BIANCHI ],
  "iswc": "T-070237182-9",
  "verifi_id": "0x7cf232e7c48d6ba5d8bd3101fc7a28071091165de2f1b4542c37e2812d89154be",
  "version_type": "Original work",
  "publishers": [ WCM, AMP ],
  "copyright_notice": "© 2019 Warner Chappell Music, © 2019 Allegro Music Publishing"
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
  "song_title": "The Sun Comes Out",
  "artist": "Bella Swan",
  "album": "Love the Love",
  "cover_art": "media-registry/covers/The-Sun-Comes-Out.jpg",
  "cover_art_thumb": "media-registry/covers/thumb/The-Sun-Comes-Out.jpg",
  "cover_art_medium": "media-registry/covers/medium/The-Sun-Comes-Out.jpg",
  "cover_art_large": "media-registry/covers/large/The-Sun-Comes-Out.jpg",
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
