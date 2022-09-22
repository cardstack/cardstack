import Component from '@glimmer/component';
import BoxelControlPanel from './index';
import BoxelButton from '../button';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';

export default class extends Component {
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
            <BoxelButton @kind="secondary-dark">Gear something</BoxelButton>
          </cp.Item>
          <cp.Item @title="Pin" @icon="pin">two</cp.Item>
        </BoxelControlPanel>
      </:example>
    </FreestyleUsage>
  </template>
}
