import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelThread from './index';
import BoxelAddParticipantButton from '../add-participant-button';
import BoxelButton from '../button';
import BoxelDateDivider from '../date-divider';
import BoxelHelpBox from '../help-box';
import BoxelParticipantList from '../participant-list';
import BoxelProgressCircle from '../progress-circle';
import BoxelProgressSteps from '../progress-steps';
import BoxelThreadHeader from '../thread-header';
import BoxelThreadMessage from '../thread-message';
import BoxelSidebarCardContainer from '../sidebar/card-container';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn } from '@ember/helper';

import { on } from '@ember/modifier';
import dayjsFormat from '@cardstack/boxel/helpers/dayjs-format';
import optional from 'ember-composable-helpers/helpers/optional';
import percentComplete from '@cardstack/boxel/helpers/percent-complete';

import CardBot from '@cardstack/boxel/usage-support/images/orgs/cardbot.svg';
import User from '@cardstack/boxel/usage-support/images/users/Gary-Walker.jpg';
import './usage.css';

const USER = {
  title: 'Gary Walker',
  imgURL: User,
};

const BOT = {
  title: 'Cardbot',
  imgURL: CardBot,
};

const USER_GROUP = [USER];

const ORG_GROUP = [BOT];

const MILESTONES = [
  {
    title: 'Milestone 1',
    statusOnCompletion: 'Milestone 1 completed',
    senderIcon: BOT.imgURL,
    message: 'Hello, it’s nice to see you!',
  },
  {
    title: 'Milestone 2',
    statusOnCompletion: 'Milestone 2 completed',
  },
  {
    title: 'Milestone 3',
    statusOnCompletion: 'Milestone 3 completed',
  },
];

export default class ThreadMessageUsageComponent extends Component {
  cardBotIcon = CardBot;
  orgGroup = ORG_GROUP;
  userGroup = USER_GROUP;
  milestones = MILESTONES;
  @tracked messages: number[] = [1];
  @tracked autoscroll = false;

  @action addMessage(): void {
    this.messages = [...this.messages, 1];
  }

  @action addParticipant(): void {
    // no op
  }

  <template>
    <FreestyleUsage @name="Thread">
      <:description>
        <BoxelButton {{on "click" this.addMessage}}>Add a message</BoxelButton>
      </:description>
      <:example>
        <BoxelThread @autoscroll={{this.autoscroll}} class="boxel-thread-usage">
          <:header>
            <BoxelThreadHeader @title="Project Title" />
          </:header>

          <:content>
            <BoxelDateDivider @date={{dayjsFormat "2021-10-31"}} />
            {{#each this.messages}}
              <BoxelThreadMessage
                @name="Cardbot"
                @hideName={{true}}
                @imgURL={{this.cardBotIcon}}
                @datetime="2021-10-31T3:00"
              >
                Hello, it's nice to see you!
              </BoxelThreadMessage>
            {{/each}}
          </:content>
        </BoxelThread>
      </:example>

      <:api as |Args|>
      <Args.Bool
        @name="autoscroll"
        @description="Whether to automatically scroll down to newly added elements if the user is close enough to the end of the thread (see the autoscroll modifier)."
        @default={{false}}
        @value={{this.autoscroll}}
        @onInput={{fn (mut this.autoscroll)}}
      />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @slug="Thread-with-workflow">
      <:example>
        <BoxelThread>
          <:header>
            <BoxelThreadHeader @title="Project Title" />
          </:header>

          <:content>
            <BoxelDateDivider @date={{dayjsFormat "2021-10-31"}} />
            <BoxelThreadMessage
              @name="Cardbot"
              @hideName={{true}}
              @imgURL={{this.milestones.0.senderIcon}}
              @datetime="2021-10-31T3:00"
            >
              {{this.milestones.0.message}}
            </BoxelThreadMessage>
          </:content>

          <:sidebar as |SidebarSection|>
            <SidebarSection>
              <BoxelSidebarCardContainer
                @header="Workflow: Project Title"
                @attachNext={{true}}
              >
                <div>
                  <BoxelProgressCircle
                    @percentComplete={{percentComplete total=this.milestones.length completed=0}}
                  />
                </div>
                <div>
                  Workflow started
                </div>
              </BoxelSidebarCardContainer>

              <BoxelSidebarCardContainer @header="Milestones">
                <BoxelProgressSteps
                  @progressSteps={{this.milestones}}
                  @completedCount={{0}}
                />
              </BoxelSidebarCardContainer>
            </SidebarSection>

            <SidebarSection>
              <BoxelHelpBox @url="mailto:support@cardstack.com" />
            </SidebarSection>

            <SidebarSection>
              <BoxelSidebarCardContainer
                @header="Participants"
                @attachNext={{true}}
              >
                <BoxelParticipantList
                  @fullWidth={{true}}
                  @participants={{this.userGroup}}
                />
              </BoxelSidebarCardContainer>

              <BoxelSidebarCardContainer>
                <BoxelParticipantList
                  @fullWidth={{true}}
                  @participants={{this.orgGroup}}
                />
                <BoxelAddParticipantButton
                  {{on "click" (optional this.addParticipant)}}
                />
              </BoxelSidebarCardContainer>
            </SidebarSection>
          </:sidebar>
        </BoxelThread>
      </:example>
    </FreestyleUsage>

  </template>
}
