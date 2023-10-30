export {};

declare global {
  /**
   * Now declare things that go in the global namespace,
   * or augment existing declarations in the global namespace.
   */
  interface StudyInfo {
    publisher?: string | undefined,
    studyNumber?: string | undefined,
    url?: string,
    urlParams?: URLSearchParams,
    urlPath?: string,
    fileName?: string,
    testDate: string
  }

}
