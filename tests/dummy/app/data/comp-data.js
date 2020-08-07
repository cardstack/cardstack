// ORGS
export const AMP = {
  type: 'publisher',
  territory: 'worldwide',
  id: 'allegro-music-publishing',
  title: 'Allegro Music Publishing',
  fields: [
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
  id: 'warner-chappel-music',
  title: 'Warner Chappel Music',
  fields: [
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
  "imgURL": "",
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
  "imgURL": null,
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
  "imgURL": null,
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


