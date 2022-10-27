import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import Boxel<%= classifiedModuleName %> from './index';
import { tracked } from '@glimmer/tracking';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { fn } from '@ember/helper';

export default class Boxel<%= classifiedModuleName %>Usage extends Component {
  cssClassName = '<%= cssClassName %>';

  @cssVariable declare boxel<%= classifiedModuleName %>BackgroundColor: CSSVariableInfo; // TODO: replace or remove
  @tracked someProp = 'someValue'; // TODO: replace or remove

  <template>
    <FreestyleUsage @name="<%= classifiedModuleName %>">
      <:description>
        A brief description of <%= classifiedModuleName %>.
      </:description>
      <:example>
        <Boxel<%= classifiedModuleName %>
          @someProp={{this.someProp}}
          style={{cssVar
            <%= cssClassName %>-background-color=this.boxel<%= classifiedModuleName %>BackgroundColor.value
          }}
        >
          Hello, world.
        </Boxel<%= classifiedModuleName %>>
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="someProp"
          @description="A decription of the someProp property"
          @value={{this.someProp}}
          @onInput={{fn (mut this.someProp)}}
        />
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="<%= cssClassName %>-background-color"
          @type="color"
          @defaultValue={{this.boxel<%= classifiedModuleName %>BackgroundColor.defaults}}
          @value={{this.boxel<%= classifiedModuleName %>BackgroundColor.value}}
          @onInput={{this.boxel<%= classifiedModuleName %>BackgroundColor.update}}
        />
      </:cssVars>
    </FreestyleUsage>
  </template>
}
