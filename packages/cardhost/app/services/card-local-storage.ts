import Service from '@ember/service';

/**
 * The CardLocalStorage service is responsible for storing client-side data,
 * such as the ids of recently created Cards.
 * It uses the native localStorage browser API:
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Local_storage
 * Local storage is only destroyed when the cache is cleared, in contrast
 * to session storage that is cleared as soon as a browser window is closed.
 */

/**
 * Polyfill for browsers that lack local storage, replacing it with cookies. Copied from
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Local_storage
 */

export default class CardLocalStorageService extends Service {
  getDevice() {
    let tempId = localStorage.getItem('Device');
    if (tempId === null) {
      return '';
    } else {
      return JSON.parse(tempId);
    }
  }

  setDevice() {
    // Per documentation, you should catch errors because private
    // browsers disallow setting items and will throw exceptions

    // if there isn't already an id in local storage, generate it
    let id = this.getDevice() ? this.getDevice() : this.generateTempSemiRandomId();
    try {
      let stringified = JSON.stringify(id);
      localStorage.setItem('Device', stringified);
      return id;
    } catch (err) {
      throw err;
    }
  }

  clearDevice() {
    localStorage.removeItem('Device');
  }

  generateTempSemiRandomId() {
    return btoa(Math.random().toString()).slice(0, -5);
  }
}
