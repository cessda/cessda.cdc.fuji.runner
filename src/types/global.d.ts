export {};

declare global {
  /**
   * Now declare things that go in the global namespace,
   * or augment existing declarations in the global namespace.
   */
  interface StudyInfo {
    url?: string,
    urlParams?: URLSearchParams,
    urlPath?: string,
    publisher?: string | undefined,
    spID?: string | null,
    cdcID?: string | null,
    cdcStudyNumber?: string | undefined,
    oaiLink?: string,
    fileName?: string,
    assessDate?: string,
  }

}
