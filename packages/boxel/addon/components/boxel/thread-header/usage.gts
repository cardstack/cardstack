import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelThreadHeader from './index';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { A } from '@ember/array';
import { fn } from '@ember/helper';

import HaleyOConnellThumb from '@cardstack/boxel/usage-support/images/users/Haley-OConnell.jpg';
import JuliaMasonThumb from '@cardstack/boxel/usage-support/images/users/Julia-Mason.jpg';

const SAMPLE_PARTICIPANTS = [
  {
    title: 'Haley O’Connell',
    imgURL: HaleyOConnellThumb,
  },
  {
    title: 'Julia Mason',
    imgURL: JuliaMasonThumb,
  },
];

export default class extends Component {
  @tracked participants = A(SAMPLE_PARTICIPANTS);
  @tracked label = 'Customers';
  @tracked title = 'Purchase Order, Julia Mason';
  @tracked notificationCount = 1;
  @tracked workflowTitle = 'Prepaid Card Issuance';
  @tracked expanded = false;

  @action toggleExpand(): void {
    this.expanded = !this.expanded;
  }

  <template>
    <FreestyleUsage @name="ThreadHeader">
      <:example>
        <BoxelThreadHeader
          @label={{this.label}}
          @title={{this.title}}
          @notificationCount={{this.notificationCount}}
          @participants={{this.participants}}
        >
        </BoxelThreadHeader>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="title"
          @description="Thread title"
          @required={{true}}
          @value={{this.title}}
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="label"
          @description="Thread label"
          @value={{this.label}}
          @onInput={{fn (mut this.label)}}
        />
        <Args.Number
          @name="notificationCount"
          @description="Notification count for the thread (unread messages, etc.)"
          @value={{this.notificationCount}}
          @onInput={{fn (mut this.notificationCount)}}
        />
        <Args.Array
          @name="participants"
          @description="Participants in this thread"
          @type="Object"
          @items={{this.participants}}
          @onChange={{fn (mut this.participants)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @slug="ThreadHeader-card-pay">
      <:example>
        <BoxelThreadHeader
          @title={{this.workflowTitle}}
          @toggleExpand={{this.toggleExpand}}
          @expanded={{this.expanded}}
        >
        </BoxelThreadHeader>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="title"
          @description="Thread title"
          @required={{true}}
          @value={{this.workflowTitle}}
          @onInput={{fn (mut this.workflowTitle)}}
        />
        <Args.Action
          @name="toggleExpand"
          @description="Optional expand action"
          @value={{this.toggleExpand}}
        />
        <Args.Bool
          @name="expanded"
          @description="Result of the expand action"
          @value={{this.expanded}}
          @onInput={{fn (mut this.expanded)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
