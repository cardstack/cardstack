import Component from '@glimmer/component';

export default class ColorPalette extends Component {
  colors = {
    '--ch-default': '#2e2d38',
    '--ch-hover': '#272330',
    '--ch-disabled': '#393642',
    '--ch-highlight': '#00ebe5',
    '--ch-highlight-hover': '#00b0ad',
    '--ch-success': '#37eb77',
    '--ch-dark-background': '#41404d',
    '--ch-light-background': '#e9e9ed',
    '--ch-deep-background': '#141428',
    '--ch-foreground': '#5a586a',
    '--ch-foreground-hover': '#434050',
    '--ch-border': '#5b596e',
    '--ch-light': '#fff',
    '--ch-dark': '#000',
    '--ch-alert': '#ff0000',
    '--ch-light-op60': 'rgba(255, 255, 255, 0.6)',
    '--ch-dark-op50': 'rgba(0, 0, 0, 0.5)',
  };
}
