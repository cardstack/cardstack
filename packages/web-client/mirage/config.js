import Pattern1 from '@cardstack/web-client/images/test/prepaid-card-pattern-1.svg';
import Pattern2 from '@cardstack/web-client/images/test/prepaid-card-pattern-2.svg';
import Pattern3 from '@cardstack/web-client/images/test/prepaid-card-pattern-3.svg';
import Pattern4 from '@cardstack/web-client/images/test/prepaid-card-pattern-4.svg';

let colors = [
  {
    attributes: {
      background: '#FFD800',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#FFD800',
  },
  {
    attributes: {
      background: '#37EB77',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#37EB77',
  },
  {
    attributes: {
      background: '#C3FC33',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#C3FC33',
  },
  {
    attributes: {
      background: '#00EBE5',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#00EBE5',
  },
  {
    attributes: {
      background: '#F5F5F5',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#F5F5F5',
  },
  {
    attributes: {
      background: '#FFEDDB',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#FFEDDB',
  },
  {
    attributes: {
      background: '#FFDBE5',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#FFDBE5',
  },
  {
    attributes: {
      background: '#E9DBFF',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: '#E9DBFF',
  },
  {
    attributes: {
      background: '#AC00FF',
      'text-color': 'white',
      'pattern-color': 'black',
    },
    id: '#AC00FF',
  },
  {
    attributes: {
      background: '#393642',
      'text-color': 'white',
      'pattern-color': 'black',
    },
    id: '#393642',
  },
  {
    attributes: {
      background: '#0069F9',
      'text-color': 'white',
      'pattern-color': 'black',
    },
    id: '#0069F9',
  },
  {
    attributes: {
      background: '#FF5050',
      'text-color': 'white',
      'pattern-color': 'black',
    },
    id: '#FF5050',
  },
  {
    attributes: {
      background: 'linear-gradient(139.27deg, #00EBE5 16%, #C3FC33 100%)',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: 'linear-gradient(139.27deg, #00EBE5 16%, #C3FC33 100%)',
  },
  {
    attributes: {
      background: 'linear-gradient(139.27deg, #FC8C8C 16%, #FFF5A7 100%)',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: 'linear-gradient(139.27deg, #FC8C8C 16%, #FFF5A7 100%)',
  },
  {
    attributes: {
      background: 'linear-gradient(139.27deg, #FF88D1 16%, #A3FFFF 100%)',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: 'linear-gradient(139.27deg, #FF88D1 16%, #A3FFFF 100%)',
  },
  {
    attributes: {
      background: 'linear-gradient(139.27deg, #FFFFAA 16%, #B7FFFC 100%)',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: 'linear-gradient(139.27deg, #FFFFAA 16%, #B7FFFC 100%)',
  },
  {
    attributes: {
      background: 'linear-gradient(139.27deg, #004DB7 16%, #00C18D 100%)',
      'text-color': 'white',
      'pattern-color': 'black',
    },
    id: 'linear-gradient(139.27deg, #004DB7 16%, #00C18D 100%)',
  },
  {
    attributes: {
      background: 'linear-gradient(139.27deg, #9300FF 16%, #FF0058 100%)',
      'text-color': 'white',
      'pattern-color': 'black',
    },
    id: 'linear-gradient(139.27deg, #9300FF 16%, #FF0058 100%)',
  },
  {
    attributes: {
      background: 'transparent',
      'text-color': 'black',
      'pattern-color': 'white',
    },
    id: 'transparent',
  },
];

let patterns = [
  {
    attributes: {
      'pattern-url': null,
    },
    id: 'blank',
  },
  {
    attributes: {
      'pattern-url': Pattern1,
    },
    id: 'pattern-1',
  },
  {
    attributes: {
      'pattern-url': Pattern2,
    },
    id: 'pattern-2',
  },
  {
    attributes: {
      'pattern-url': Pattern3,
    },
    id: 'pattern-3',
  },
  {
    attributes: {
      'pattern-url': Pattern4,
    },
    id: 'pattern-4',
  },
];

export default function () {
  this.namespace = 'api';

  this.get('/prepaid-card-color-schemes', () => {
    return {
      data: colors,
    };
  });

  this.get('/prepaid-card-patterns', () => {
    return {
      data: patterns,
    };
  });

  this.passthrough((request) => {
    return (
      !request.url.includes('/api/prepaid-card-color-schemes') &&
      !request.url.includes('/api/prepaid-card-patterns')
    );
  });
}
