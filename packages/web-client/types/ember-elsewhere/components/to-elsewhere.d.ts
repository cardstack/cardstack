import Component from '@glimmer/component';

interface Signature {
  Element: undefined;
  Args: {
    named: string;
    send: any;
  };
}

// eslint-disable-next-line ember/no-empty-glimmer-component-classes
export default class ToElsewhere extends Component<Signature> {}
