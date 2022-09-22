import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelThreadMessage from './index';
import BoxelActionChin from '../action-chin';
import BoxelCardContainer from '../card-container';
import BoxelHeader from '../header';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { action } from '@ember/object';
import cn from '@cardstack/boxel/helpers/cn';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { fn } from '@ember/helper';
import gt from 'ember-truth-helpers/helpers/gt';
import { on } from '@ember/modifier';

import './usage.css';

import LolaSampsonThumb from '@cardstack/boxel/usage-support/images/users/Lola-Sampson.jpg';
import CardBot from '@cardstack/boxel/usage-support/images/orgs/cardbot.svg';

export default class ThreadMessageUsage extends Component {
  cardbotIcon = CardBot;
  @tracked name = 'Lola Sampson';
  @tracked imgURL = LolaSampsonThumb;
  @tracked datetime = '2020-03-07T10:11';
  @tracked notRound = false;
  @tracked hideMeta = false;
  @tracked hideName = false;
  @tracked messageArray = A([
    'Hello, it’s nice to see you!',
    'Let’s issue a Prepaid Card.',
    'First, you can choose the look and feel of your card, so that your customers and other users recognize that this Prepaid Card came from you.',
  ]);
  @tracked fullWidth = false;

  @tracked avatarSize = '2.5rem';
  @tracked metaHeight = '1.25rem';
  @tracked gap = 'var(--boxel-sp)';
  @tracked marginLeft =
    'calc(var(--boxel-thread-message-avatar-size) + var(--boxel-thread-message-gap))';

  @tracked layoutExampleFullWidth = false;
  @action toggleLayoutExampleFullWidth(): void {
    this.layoutExampleFullWidth = !this.layoutExampleFullWidth;
  }
  @tracked isComplete = false;
  @action toggleIsComplete(): void {
    this.isComplete = !this.isComplete;
  }

  <template>
    <FreestyleUsage @name="ThreadMessage">
      <:example>
        <BoxelThreadMessage
          @name={{this.name}}
          @imgURL={{this.imgURL}}
          @datetime={{this.datetime}}
          @notRound={{this.notRound}}
          @hideMeta={{this.hideMeta}}
          @hideName={{this.hideName}}
          @fullWidth={{this.fullWidth}}
          style={{cssVar
            boxel-thread-message-avatar-size=this.avatarSize
            boxel-thread-message-meta-height=this.metaHeight
            boxel-thread-message-gap=this.gap
            boxel-thread-message-margin-left=this.marginLeft
          }}
        >
          Hi Haley, Here’s your manuscript with all the edits I would recommend. Please review and let me know if you have any questions. I also added a couple tasks for you about things you should think about, as you figure out the rest of your story.
        </BoxelThreadMessage>
      </:example>
      <:api as |Args|>
        <Args.Yield
          @description="Message content"
          @required={{true}}
        />
        <Args.String
          @name="name"
          @description="The name displayed above the message"
          @value={{this.name}}
          @onInput={{fn (mut this.name)}}
          @required={{true}}
        />
        <Args.String
          @name="imgURL"
          @description="URL for the user avatar"
          @value={{this.imgURL}}
          @onInput={{fn (mut this.imgURL)}}
        />
        <Args.String
          @name="datetime"
          @description="Message timestamp"
          @defaultValue="(now)"
          @value={{this.datetime}}
          @onInput={{fn (mut this.datetime)}}
        />
        <Args.Bool
          @name="notRound"
          @value={{this.notRound}}
          @description="Avatar is not circle-shaped. This will only work if an 'imgURL' arg is provided"
          @defaultValue={{false}}
          @onInput={{fn (mut this.notRound)}}
        />
        <Args.Bool
          @name="hideMeta"
          @value={{this.hideMeta}}
          @description="Visually hides the user avatar, name, and message timestamp"
          @defaultValue={{false}}
          @onInput={{fn (mut this.hideMeta)}}
        />
        <Args.Bool
          @name="hideName"
          @value={{this.hideName}}
          @description="Visually hides the user name"
          @defaultValue={{false}}
          @onInput={{fn (mut this.hideName)}}
        />
        <Args.Bool
          @name="fullWidth"
          @value={{this.fullWidth}}
          @description="Whether to allocate the full width to the content"
          @defaultValue={{false}}
          @onInput={{fn (mut this.fullWidth)}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-thread-message-avatar-size"
          @defaultValue={{unbound this.avatarSize}}
          @value={{this.avatarSize}}
          @onInput={{fn (mut this.avatarSize)}}
        />
        <Args.String
          @name="--boxel-thread-message-meta-height"
          @defaultValue={{unbound this.metaHeight}}
          @value={{this.metaHeight}}
          @onInput={{fn (mut this.metaHeight)}}
        />
        <Args.String
          @name="--boxel-thread-message-gap"
          @description="gap after avatar"
          @defaultValue={{unbound this.gap}}
          @value={{this.gap}}
          @onInput={{fn (mut this.gap)}}
        />
        <Args.String
          @name="--boxel-thread-message-margin-left"
          @defaultValue={{unbound this.marginLeft}}
          @value={{this.marginLeft}}
          @onInput={{fn (mut this.marginLeft)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage
      @slug="ThreadMessage-array"
    >
      <:example>
        <div role="list">
          {{#each this.messageArray as |message i|}}
            <BoxelThreadMessage
              role="listitem"
              @name="Cardbot"
              @imgURL={{this.cardbotIcon}}
              @hideMeta={{gt i 0}}
              @hideName={{true}}
              @datetime={{this.datetime}}
            >
              {{message}}
            </BoxelThreadMessage>
          {{/each}}
        </div>
      </:example>
    </FreestyleUsage>

    <FreestyleUsage @slug="with-cards">
      <:description>
        <p>
          These examples with embedded cards are using the <code>@fullWidth</code> argument to
          have access to the full-width content area. Smaller cards have a left margin the size of
          <code>var(--boxel-thread-message-margin-left)</code> css variable for alignment.
        </p>
        <p>
          Using the <code>@fullWidth</code> argument:
          <ul>
            <li>Allows the content to have access to the full-width content area</li>
            <li>Adds spacing between the timestamp and the content</li>
            <li>Vertically centers the timestamp in relation to the avatar</li>
          </ul>
        </p>
        <p>
          (Note: The messages below also have custom css applied which restricts their max-width. See <code>usage.css</code> file.)
        </p>
      </:description>
      <:example>
        <div class="thread-message-usage">
          <BoxelThreadMessage
            @name="Cardbot"
            @hideName={{true}}
            @imgURL={{this.cardbotIcon}}
            @datetime={{this.datetime}}
          >
            <p class="thread-message-usage__content">
              Hello, it’s nice to see you!
            </p>
          </BoxelThreadMessage>
          <BoxelThreadMessage
            @name="Cardbot"
            @hideName={{true}}
            @hideMeta={{true}}
            @imgURL={{this.cardbotIcon}}
            @datetime={{this.datetime}}
          >
            <p class="thread-message-usage__content">
              Let’s issue a Prepaid Card.
            </p>
          </BoxelThreadMessage>
          <BoxelThreadMessage
            @name="Cardbot"
            @hideName={{true}}
            @imgURL={{this.cardbotIcon}}
            @datetime={{this.datetime}}
          >
            <p class="thread-message-usage__content">
              Let’s get down to business. Please choose the asset you would like
              to deposit into the CARD Protocol’s reserve pool.
            </p>
          </BoxelThreadMessage>
          <BoxelThreadMessage
            @name="Cardbot"
            @hideName={{true}}
            @hideMeta={{true}}
            @imgURL={{this.cardbotIcon}}
            @fullWidth={{true}}
            @datetime={{this.datetime}}
          >
            <BoxelCardContainer
              class={{cn
                "thread-message-usage__card"
                thread-message-usage__card--memorialized=this.isComplete
              }}
            >
              <BoxelHeader @header="Card 1" />
              <p>Card 1 Content...</p>
              <BoxelActionChin
                @state={{if this.isComplete "memorialized" "default"}}>
                <:default as |d|>
                  <d.ActionButton {{on "click" this.toggleIsComplete}}>Click to toggle card completion</d.ActionButton>
                </:default>
                <:memorialized as |m|>
                  <m.ActionButton {{on "click" this.toggleIsComplete}}>Click to toggle card completion</m.ActionButton>
                </:memorialized>
              </BoxelActionChin>
            </BoxelCardContainer>
          </BoxelThreadMessage>
          <BoxelThreadMessage
            @name="Cardbot"
            @hideName={{true}}
            @imgURL={{this.cardbotIcon}}
            @fullWidth={{true}}
            @datetime={{this.datetime}}
          >
            <BoxelCardContainer
              class="thread-message-usage__card thread-message-usage__card--memorialized"
            >
              <BoxelHeader @header="Card 2" />
              <p>Card 2 Content...</p>
            </BoxelCardContainer>
          </BoxelThreadMessage>
          <BoxelThreadMessage
            @name="Cardbot"
            @hideName={{true}}
            @imgURL={{this.cardbotIcon}}
            @fullWidth={{true}}
            @datetime={{this.datetime}}
          >
            <BoxelCardContainer
              class={{cn
                "thread-message-usage__card"
                thread-message-usage__card--memorialized=this.layoutExampleFullWidth
              }}
            >
              <BoxelHeader @header="Card 3" />
              <p>Card 3 Content...</p>
              <BoxelActionChin
                @state={{if this.layoutExampleFullWidth  "memorialized" "default"}}>
                <:default as |d|>
                  <d.ActionButton {{on "click" this.toggleLayoutExampleFullWidth}}>Click to toggle card completion</d.ActionButton>
                </:default>
                <:memorialized as |m|>
                  <m.ActionButton {{on "click" this.toggleLayoutExampleFullWidth}}>Click to toggle card completion</m.ActionButton>
                </:memorialized>
                  
              </BoxelActionChin>
            </BoxelCardContainer>
          </BoxelThreadMessage>
        </div>
      </:example>
    </FreestyleUsage>
  </template>
}
