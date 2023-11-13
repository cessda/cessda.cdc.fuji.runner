import type { AxiosResponse } from "axios";
import axios from "axios";
import { logger, dashLogger } from "./logger.js";
import { requestHeaders } from "./cdcStagingConn.js";

export async function getCDCApiInfo(studyInfo: StudyInfo): Promise<StudyInfo> {
  const cdcApiUrl = 'https://datacatalogue.cessda.eu/api/json/cmmstudy_' + studyInfo.urlParams?.get('lang') + '/' + studyInfo.urlParams?.get('q');
  const cdcStagingApiUrl = 'https://datacatalogue-staging.cessda.eu/api/json/cmmstudy_' + studyInfo.urlParams?.get('lang') + '/' + studyInfo.urlParams?.get('q');
  let cdcApiRes: AxiosResponse<any, any>;
  let publisher: string = "";
  let studyNumber: string = "";
  let maxRetries: number = 10;
  let retries: number = 0;
  let success: boolean = false;

  while (retries <= maxRetries && !success) {
    try {
      if (studyInfo.url?.includes("datacatalogue-staging.cessda.eu"))
        cdcApiRes = await axios.get(cdcStagingApiUrl, { headers: requestHeaders });
      else
        cdcApiRes = await axios.get(cdcApiUrl);
      logger.info(`CDC Internal API statusCode: ${cdcApiRes.status}`);
      publisher = cdcApiRes.data.publisherFilter.publisher;
      studyNumber = cdcApiRes.data.studyNumber;
      success = true;
    }
    catch (error) {
      logger.error(`Error at CDC Internal API Fetch: ${error}`);
      dashLogger.error(`Error at CDC Internal API Fetch: ${error}, URL:${cdcApiUrl}, time:${new Date().toUTCString()}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
    }
    retries++;
  }
  if (retries >= maxRetries) {
    logger.error(`Too many  request retries on internal CDC API.`);
    dashLogger.error(`Too many  request retries on internal CDC API, URL:${cdcApiUrl}, time:${new Date().toUTCString()}`);
    if (publisher.trim().length == 0)
      publisher = "NOT-FETCHED-CDC-PUBLISHER";
    if (studyNumber.trim().length == 0)
      studyNumber = "NOT-FETCHED-CDC-STUDYNUMBER";
  }
  //add results to interface and return it
  studyInfo.publisher = publisher;
  studyInfo.cdcStudyNumber = studyNumber;
  
  return studyInfo;
}