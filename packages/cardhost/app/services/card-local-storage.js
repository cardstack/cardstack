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
if (!window.localStorage) {
  Object.defineProperty(
    window,
    'localStorage',
    new (function() {
      var aKeys = [],
        oStorage = {};
      Object.defineProperty(oStorage, 'getItem', {
        value: function(sKey) {
          return this[sKey] ? this[sKey] : null;
        },
        writable: false,
        configurable: false,
        enumerable: false,
      });
      Object.defineProperty(oStorage, 'key', {
        value: function(nKeyId) {
          return aKeys[nKeyId];
        },
        writable: false,
        configurable: false,
        enumerable: false,
      });
      Object.defineProperty(oStorage, 'setItem', {
        value: function(sKey, sValue) {
          if (!sKey) {
            return;
          }
          document.cookie = escape(sKey) + '=' + escape(sValue) + '; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/';
        },
        writable: false,
        configurable: false,
        enumerable: false,
      });
      Object.defineProperty(oStorage, 'length', {
        get: function() {
          return aKeys.length;
        },
        configurable: false,
        enumerable: false,
      });
      Object.defineProperty(oStorage, 'removeItem', {
        value: function(sKey) {
          if (!sKey) {
            return;
          }
          document.cookie = escape(sKey) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        },
        writable: false,
        configurable: false,
        enumerable: false,
      });
      Object.defineProperty(oStorage, 'clear', {
        value: function() {
          if (!aKeys.length) {
            return;
          }
          for (var sKey in oStorage) {
            document.cookie = escape(sKey) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          }
        },
        writable: false,
        configurable: false,
        enumerable: false,
      });
      this.get = function() {
        var iThisIndx;
        for (var sKey in oStorage) {
          iThisIndx = aKeys.indexOf(sKey);
          if (iThisIndx === -1) {
            oStorage.setItem(sKey, oStorage[sKey]);
          } else {
            aKeys.splice(iThisIndx, 1);
          }
          delete oStorage[sKey];
        }
        for (aKeys; aKeys.length > 0; aKeys.splice(0, 1)) {
          oStorage.removeItem(aKeys[0]);
        }
        for (var aCouple, iKey, nIdx = 0, aCouples = document.cookie.split(/\s*;\s*/); nIdx < aCouples.length; nIdx++) {
          aCouple = aCouples[nIdx].split(/\s*=\s*/);
          if (aCouple.length > 1) {
            oStorage[(iKey = unescape(aCouple[0]))] = unescape(aCouple[1]);
            aKeys.push(iKey);
          }
        }
        return oStorage;
      };
      this.configurable = false;
      this.enumerable = true;
    })()
  );
}

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
      localStorage.setItem('Device', JSON.stringify(id));
    } catch (err) {
      throw err;
    }
  }

  clearDevice() {
    localStorage.removeItem('Device');
  }

  generateTempSemiRandomId() {
    return btoa(Math.random()).slice(0, -5);
  }
}
