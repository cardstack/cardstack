export function setupHubAuthenticationToken(hooks: any) {
  hooks.beforeEach(function () {
    window.TEST__AUTH_TOKEN = 'abc123--def456--ghi789';
  });
  hooks.afterEach(function () {
    delete window.TEST__AUTH_TOKEN;
  });
}
