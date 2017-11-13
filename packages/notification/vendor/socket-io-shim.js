(function() {
  function vendorModule() {
    'use strict';

    return { default: window.io };
  }
  define('socket-io', [], vendorModule);
})();
