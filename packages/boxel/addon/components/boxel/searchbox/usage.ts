import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { assert } from '@ember/debug';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle';

export default class SearchboxUsage extends Component {
  @tracked value = '';
  @tracked id = 'searchbox-id';
  @tracked label = 'A searchbox example input';
  @tracked placeholder = 'Search';
  @tracked hideIcon = false;

  @cssVariable({ cssClassName: 'boxel-searchbox' })
  declare boxelSearchboxIconSize: CSSVariableInfo;

  @action onInput(e: InputEvent): void {
    let target = e.target;
    assert('target', target && target instanceof HTMLInputElement);
    console.log('input:', target.value);
    this.value = target.value;
  }

  @action onChange(e: InputEvent): void {
    let target = e.target;
    assert('target', target && target instanceof HTMLInputElement);
    console.log('change', target.value);
  }

  @action onClear(): void {
    this.value = '';
  }
}
