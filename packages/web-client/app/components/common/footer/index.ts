import Component from '@glimmer/component';

export default class FooterComponent extends Component {
  currentYear = new Date().getFullYear();
}
