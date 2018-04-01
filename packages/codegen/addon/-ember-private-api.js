export function unload(moduleName, modulePrefix, owner) {
  if (window.requirejs.entries[moduleName]) {
    window.requirejs.unsee(moduleName);
  }
  let parts = moduleName.split('/');
  if (parts[0] === modulePrefix  && parts[1] === 'models') {
    clearResolveCache(owner.__registry__, `model:${parts[2]}`);
  }
}

function clearResolveCache(registry, key) {
  delete registry._resolveCache[key];
  if (registry.fallback) {
    clearResolveCache(registry.fallback, key);
  }
}
