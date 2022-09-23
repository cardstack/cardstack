import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelSidebar from './index';
import BoxelSidebarCardContainer from './card-container';
import './usage.css';

export default class SidebarUsage extends Component {
  <template>
    <FreestyleUsage @name="Sidebar">
      <:example>
        <h2>Three examples:</h2>
        <div role="list" class="sidebar-usage-container">
          <div role="listitem">
            <h3>Example 1:</h3>
            <BoxelSidebar as |SidebarSection|>
              <SidebarSection @title="Section Title">
                <div>Content goes here!</div>
                <div>Some more goes here!</div>
              </SidebarSection>
              <SidebarSection @title="Another Title">
                <div>Content goes here!</div>
                <div>Some more goes here!</div>
              </SidebarSection>
            </BoxelSidebar>
          </div>
          <div role="listitem">
            <h3>Example 2:</h3>
            <BoxelSidebar as |SidebarSection|>
              <SidebarSection @title="Section Title">
                <BoxelSidebarCardContainer @header="Title">
                  Content goes here
                </BoxelSidebarCardContainer>
              </SidebarSection>
              <SidebarSection>
                <BoxelSidebarCardContainer>
                  <div>This one has no title</div>
                </BoxelSidebarCardContainer>
              </SidebarSection>
            </BoxelSidebar>
          </div>
          <div role="listitem">
            <h3>Example 3:</h3>
            <BoxelSidebar as |SidebarSection|>
              <SidebarSection>
                <BoxelSidebarCardContainer
                  @header="Sidebar Card Container Title"
                  @attachNext={{true}}
                >
                  <div>Content goes here!</div>
                  <div>Some more goes here!</div>
                </BoxelSidebarCardContainer>

                <BoxelSidebarCardContainer
                  @header="Another Sidebar Card Container Title"
                  @attachNext={{true}}
                >
                  <div>Notice how this one is attached to the one above!</div>
                  <div>Some more goes here!</div>
                </BoxelSidebarCardContainer>

                <BoxelSidebarCardContainer>
                  <div>This one has no title</div>
                </BoxelSidebarCardContainer>
              </SidebarSection>

              <SidebarSection @title="A Different Section">
                <BoxelSidebarCardContainer @header="Another Title">
                  <div>More Content</div>
                </BoxelSidebarCardContainer>
              </SidebarSection>
            </BoxelSidebar>
          </div>
        </div>
      </:example>
    </FreestyleUsage>
  </template>
}