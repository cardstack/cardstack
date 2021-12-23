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
              name: 'All systems down.',
              impact: 'critical',
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
        'All systems down. For more details, check our status page'
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
              name: 'All systems down.',
              impact: 'major',
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
              name: 'One small system down.',
              impact: 'minor',
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
        'One small system down. For more details, check our status page'
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
              name: 'All systems down.',
              impact: 'major',
              started_at: '2021-10-10T10:10:00.000Z',
            },
            {
              name: 'One small system down.',
              impact: 'minor',
              started_at: '2021-10-10T10:10:00.003Z',
            },
            {
              name: 'World down.',
              impact: 'critical',
              started_at: '2021-10-10T10:10:00.002Z',
            },
            {
              name: 'Internet down.',
              impact: 'critical',
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
      .containsText('World down. For more details, check our status page');
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
              name: 'We are experiencing issues',
              impact: 'major',
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
        'We are experiencing issues. For more details, check our status page'
      );
  });
});
