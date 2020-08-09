// ORGS
export const AMP = {
  type: 'publisher',
  territory: 'worldwide',
  id: 'amp',
  title: 'Allegro Music Publishing',
  fields: [
    {
      title: 'IPI',
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
  type: 'publisher',
  territory: 'worldwide',
  id: 'wcm',
  imgURL: '/media-registry/wcm-logo.png',
  title: 'Warner Chappell Music',
  fields: [
    {
      title: 'IPI',
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
const VALENTINO_SOLANO = {
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


