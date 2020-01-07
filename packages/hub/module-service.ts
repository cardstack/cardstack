export class ModuleService {}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    modules: ModuleService;
  }
}
