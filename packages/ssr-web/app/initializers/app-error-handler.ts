import Ember from 'ember';
import { getSentry } from '../utils/sentry';

/**
 * Initializer to attach an `onError` hook to your app running in fastboot. It catches any run loop
 * exceptions and other errors and prevents the node process from crashing.
 */
export default {
  name: 'app-error-handler',

  initialize: function () {
    // This actually is not usually called. Most of the time we'll rely on the application route to send errors to Sentry
    Ember.onerror = function (err) {
      const errorMessage = `There was an error running your app in fastboot. More info about the error: \n ${
        err.stack || err
      }`;
      console.error(errorMessage);
      getSentry().captureException(err);
    };
  },
};
