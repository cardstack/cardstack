import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelTabBar from './index';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array, hash } from '@ember/helper';
import menuItem from '@cardstack/boxel/helpers/menu-item';
import link from 'ember-link/helpers/link';
import cssVar from '@cardstack/boxel/helpers/css-var';

export default class TabBarUsage extends Component {
  @tracked backgroundColor = 'inherit';
  @tracked borderBottom = '1px solid var(--boxel-light-500)';
  @tracked colorActive = 'inherit';
  @tracked font = 'inherit';
  @tracked fontWeightHover = '600';

  @tracked spread = false;

  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  <template>
    <FreestyleUsage @name="TabBar">
      <:description>
        The container has <code>role='tablist'</code>.
        The generated links have <code>role='tab'</code> and <code>id=[routeName]</code>,
        so the corresponding <code>role="tabpanel"</code> element can have <code>aria-labelledby=[routeName]</code>.
      </:description>
      <:example>
        <BoxelTabBar
          @items={{array
            (menuItem
              "Home"
              (link route="index")
            )
            (menuItem
              "Docs"
              (link route="docs" query=(hash s="Components" ss="<Boxel::TabBar>"))
            )
            (menuItem
              "About"
              (link route="about")
              inactive=true
            )
          }}
          @spread={{this.spread}}
          style={{cssVar
            boxel-tab-bar-background-color=this.backgroundColor
            boxel-tab-bar-border-bottom=this.borderBottom
            boxel-tab-bar-color-active=this.colorActive
            boxel-tab-bar-font=this.font
            boxel-tab-bar-font-weight-hover=this.fontWeightHover
          }}
        />
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="items"
          @description="An array of link MenuItems, created using the 'menu-item' helper. The menu-item helper accepts the menu item text as its first argument, and a link (as created using ember-link) as the second argument."
        />
        <Args.Bool
          @name="spread"
          @optional={{true}}
          @description="Should the items spread across the width of the container?"
          @onInput={{fn (mut this.spread)}}
          @value={{this.spread}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-tab-bar-background-color"
          @defaultValue={{unbound this.backgroundColor}}
          @value={{this.backgroundColor}}
          @onInput={{fn (mut this.backgroundColor)}}
        />
        <Args.String
          @name="--boxel-tab-bar-color-active"
          @defaultValue={{unbound this.colorActive}}
          @value={{this.colorActive}}
          @onInput={{fn (mut this.colorActive)}}
        />
        <Args.String
          @name="--boxel-tab-bar-border-bottom"
          @defaultValue={{unbound this.borderBottom}}
          @value={{this.borderBottom}}
          @onInput={{fn (mut this.borderBottom)}}
        />
        <Args.String
          @name="--boxel-tab-bar-font"
          @defaultValue={{unbound this.font}}
          @value={{this.font}}
          @onInput={{fn (mut this.font)}}
        />
        <Args.String
          @name="--boxel-tab-bar-font-weight-hover"
          @defaultValue={{unbound this.fontWeightHover}}
          @value={{this.fontWeightHover}}
          @onInput={{fn (mut this.fontWeightHover)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="TabBar with ids and icons">
      <:description>
        The <code>id</code> for the generated link can be overridden to ensure uniqueness.
      </:description>
      <:example>
        <BoxelTabBar
          @items={{array
            (menuItem "Home" (link route="index") icon="gear" id="home2")
            (menuItem "Docs" (link route="docs" query=(hash s="Components" ss="<Boxel::TabBar>")) icon="clock" id="demo2")
            (menuItem "About" (link route="about") icon="library" inactive=true id="about2")
          }}
          @spread={{true}}
        />
      </:example>
    </FreestyleUsage>

  </template>
}
