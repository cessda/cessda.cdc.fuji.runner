export interface StudyInfo {
  url: string,
  urlParams: URLSearchParams,
  urlPath: string,
  publisher: string | undefined,
  spID: string | undefined,
  cdcID: string | undefined,
  cdcStudyNumber: string | undefined,
  oaiLink: string,
  fileName: string,
  assessDate: string,
}
