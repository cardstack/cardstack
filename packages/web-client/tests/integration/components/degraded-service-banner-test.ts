import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { setupMirage } from 'ember-cli-mirage/test-support';
import config from '@cardstack/web-client/config/environment';

interface Context extends MirageTestContext {}

let statusPageUrl = `${config.urls.statusPageUrl}/api/v2/incidents/unresolved.json`;

module('Integration | Component | degraded-service-banner', function (hooks) {
  setupRenderingTest(hooks);
  setupMirage(hooks);

  test('It doesn not display a banner when there are no incidents', async function (this: Context, assert) {
    this.server.get(statusPageUrl, function () {
      return new MirageResponse(
        200,
        {},
        {
          incidents: [],
        }
      );
    });

    await render(hbs`<Common::DegradedServiceBanner />`);

    assert.dom('[data-test-degraded-service-banner]').doesNotExist();
  });

  test('It shows a critical impact incident as severe', async function (this: Context, assert) {
    this.server.get(statusPageUrl, function () {
      return new MirageResponse(
        200,
        {},
        {
          incidents: [
            {
              name: 'Name',
              impact: 'critical',
              incident_updates: [
                { body: 'An old error' },
                { body: 'All systems down.' },
              ],
            },
          ],
        }
      );
    });

    await render(hbs`<Common::DegradedServiceBanner />`);
    await waitFor('[data-test-degraded-service-banner]');
    assert
      .dom('[data-test-degraded-service-banner]')
      .containsText(
        'Name: All systems down. For more details, check our status page'
      );
    assert
      .dom('[data-test-degraded-service-banner]')
      .hasClass('degraded-service-banner--severe');
  });

  test('It shows a major impact incident as severe', async function (this: Context, assert) {
    this.server.get(statusPageUrl, function () {
      return new MirageResponse(
        200,
        {},
        {
          incidents: [
            {
              name: 'Name',
              impact: 'major',
              incident_updates: [{ body: 'All systems down.' }],
            },
          ],
        }
      );
    });

    await render(hbs`<Common::DegradedServiceBanner />`);
    await waitFor('[data-test-degraded-service-banner]');
    assert
      .dom('[data-test-degraded-service-banner]')
      .hasClass('degraded-service-banner--severe');
  });

  test('It shows a minor impact incident as default', async function (this: Context, assert) {
    this.server.get(statusPageUrl, function () {
      return new MirageResponse(
        200,
        {},
        {
          incidents: [
            {
              name: 'Name',
              impact: 'minor',
              incident_updates: [{ body: 'One small system down.' }],
            },
          ],
        }
      );
    });

    await render(hbs`<Common::DegradedServiceBanner />`);
    await waitFor('[data-test-degraded-service-banner]');
    assert
      .dom('[data-test-degraded-service-banner]')
      .containsText(
        'Name: One small system down. For more details, check our status page'
      );
    assert
      .dom('[data-test-degraded-service-banner]')
      .doesNotHaveClass('degraded-service-banner--severe');
  });

  test('It shows only the most recent and most impactful incident', async function (this: Context, assert) {
    this.server.get(statusPageUrl, function () {
      return new MirageResponse(
        200,
        {},
        {
          incidents: [
            {
              name: 'Ignored',
              impact: 'major',
              incident_updates: [{ body: 'All systems down.' }],
              started_at: '2021-10-10T10:10:00.000Z',
            },
            {
              name: 'Ignored',
              impact: 'minor',
              incident_updates: [{ body: 'One small system down.' }],
              started_at: '2021-10-10T10:10:00.003Z',
            },
            {
              name: 'Shown',
              impact: 'critical',
              incident_updates: [{ body: 'World down.' }],
              started_at: '2021-10-10T10:10:00.002Z',
            },
            {
              name: 'Ignored',
              impact: 'critical',
              incident_updates: [{ body: 'Internet down.' }],
              started_at: '2021-10-10T10:10:00.001Z',
            },
          ],
        }
      );
    });

    await render(hbs`<Common::DegradedServiceBanner />`);
    await waitFor('[data-test-degraded-service-banner]');
    assert
      .dom('[data-test-degraded-service-banner]')
      .containsText(
        'Shown: World down. For more details, check our status page'
      );
    assert
      .dom('[data-test-degraded-service-banner]')
      .hasClass('degraded-service-banner--severe');
  });

  test('It adds punctuation if missing', async function (this: Context, assert) {
    this.server.get(statusPageUrl, function () {
      return new MirageResponse(
        200,
        {},
        {
          incidents: [
            {
              name: 'Name',
              impact: 'major',
              incident_updates: [{ body: 'We are experiencing issues' }],
            },
          ],
        }
      );
    });

    await render(hbs`<Common::DegradedServiceBanner />`);
    await waitFor('[data-test-degraded-service-banner]');
    assert
      .dom('[data-test-degraded-service-banner]')
      .containsText(
        'Name: We are experiencing issues. For more details, check our status page'
      );
  });
});
