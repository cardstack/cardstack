import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import BoxelControlPanel from './index';
import BoxelButton from '../button';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';

export default class extends Component {
  // Maybe this will be template-only? Removing this causes a build failure
  @tracked value = 'placeholder;';

  <template>
    <FreestyleUsage @name="ControlPanel">
      <:description>
        xyz
      </:description>
      <:example>
        <BoxelControlPanel
          as |cp|
        >
          <cp.Item @title="Gear" @icon="gear">
            <BoxelButton @kind="secondary-dark">Gear Something</BoxelButton>
          </cp.Item>
          <cp.Item @title="Pin" @icon="pin">two</cp.Item>
          <cp.Item @title="Lock" @icon="lock">
            <BoxelButton @kind="primary">Do Lock Something</BoxelButton>
          </cp.Item>
        </BoxelControlPanel>
      </:example>
    </FreestyleUsage>
  </template>
}
