export default class IndexingService {
  // For all the realms ensure that each realm has run indexing at least once
  // and then resolve this promise.
  async update(): Promise<void> {}
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    indexing: IndexingService;
  }
}
