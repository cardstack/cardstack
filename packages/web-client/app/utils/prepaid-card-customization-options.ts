import Pattern1 from '@cardstack/web-client/images/backgrounds/prepaid-card-pattern-1.svg';
import Pattern2 from '@cardstack/web-client/images/backgrounds/prepaid-card-pattern-2.svg';
import Pattern3 from '@cardstack/web-client/images/backgrounds/prepaid-card-pattern-3.svg';
import Pattern4 from '@cardstack/web-client/images/backgrounds/prepaid-card-pattern-4.svg';

let gradient = (stop1: string, stop2: string) =>
  `linear-gradient(139.27deg, ${stop1} 16%, ${stop2} 100%)`;

let darkGradients = [
  gradient('#004DB7', '#00C18D'),
  gradient('#9300FF', '#FF0058'),
].map((colorOption) => ({
  headerBackground: colorOption,
  textColor: 'white',
  patternColor: 'black',
  id: colorOption,
}));

let dark = ['#AC00FF', '#393642', '#0069F9', '#FF5050'].map((colorOption) => ({
  headerBackground: colorOption,
  textColor: 'white',
  patternColor: 'black',
  id: colorOption,
}));

let lightGradients = [
  gradient('#00EBE5', '#C3FC33'),
  gradient('#FC8C8C', '#FFF5A7'),
  gradient('#FF88D1', '#A3FFFF'),
  gradient('#FFFFAA', '#B7FFFC'),
].map((colorOption) => ({
  headerBackground: colorOption,
  textColor: 'black',
  patternColor: 'white',
  id: colorOption,
}));

let light = [
  '#FFD800',
  '#37EB77',
  '#C3FC33',
  '#00EBE5',
  '#F5F5F5',
  '#FFEDDB',
  '#FFDBE5',
  '#E9DBFF',
].map((colorOption) => ({
  headerBackground: colorOption,
  textColor: 'black',
  patternColor: 'white',
  id: colorOption,
}));

let transparent = {
  headerBackground: 'transparent',
  textColor: 'black',
  patternColor: 'white',
  id: 'transparent',
};

export let colorOptions = light
  .concat(dark)
  .concat(lightGradients)
  .concat(darkGradients)
  .concat([transparent]);

// data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw== is a blank image
// this is so we have a valid uri for a background but it is transparent
// see https://stackoverflow.com/questions/9126105/blank-image-encoded-as-data-uri
let blankImage =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export let patternOptions = [
  Pattern1,
  Pattern2,
  Pattern3,
  Pattern4,
  blankImage,
].map((url) =>
  url === blankImage
    ? {
        patternUrl: blankImage,
        background: null,
        id: url,
      }
    : {
        patternUrl: url,
        background: null,
        id: url,
      }
);
