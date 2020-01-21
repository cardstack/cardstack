import Component from '@glimmer/component';

export default class ColorPalette extends Component {
  colors = {
    '--ch-default': '#2e2d38',
    '--ch-hover': '#272330',
    '--ch-disabled': '#393642',
    '--ch-dark-background': '#41404d',
    '--ch-light-background': '#e9e9ed',
    '--ch-deep-background': '#141428',
    '--ch-foreground': '#5a586a',
    '--ch-foreground-hover': '#434050',
    '--ch-highlight': '#00ebe5',
    '--ch-highlight-hover': '#00b0ad',
    '--ch-success': '#37eb77',
    '--ch-border': '#5b596e',
    '--ch-light': '#fff',
    '--ch-dark': '#000',
    '--ch-light-op40': '#6b6971',
    '--ch-light-op50': 'rgba(255, 255, 255, 0.5)',
    '--ch-light-op60': '#cfcfd2',
    '--ch-dark-op50': '#404040',
  };

  unthemedCardColors = {
    '--dark-gray': '#404040',
    '--medium-gray': '#707070',
    '--light-gray': 'rgba(112, 112, 112, 0.25)',
    '--red': '#ff0000',
    '--black': '#000',
    '--white': '#fff',
    '--cobalt-blue': '#0069F9',
  };
}
