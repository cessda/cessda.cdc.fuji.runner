export {};

declare global {
  /**
   * Now declare things that go in the global namespace,
   * or augment existing declarations in the global namespace.
   */
  interface StudyInfo {
    publisher?: string | undefined,
    pidStudies?: string | undefined,
    urlParams?: URLSearchParams,
    urlPath?: string
  }

}
