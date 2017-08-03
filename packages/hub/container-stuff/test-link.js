const getPackageList = require('./list-linked-packages');
const linkPackages = require('./symlink-packages');

let packages = getPackageList('/Users/aaron/dev/thing/fdsa');
linkPackages(packages).then(function() {

});

