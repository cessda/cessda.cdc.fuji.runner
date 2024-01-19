import axios from "axios";
import { logger, dashLogger } from "./logger.js";
import { requestHeaders } from "./cdcStagingConn.js";

const maxRetries: number = 10;

export async function getCDCApiInfo(id: string, lang: string, host: string) {

  const requestUrl = `https://${host}/api/json/cmmstudy_${lang}/${id}`;

  let retries: number = 0;
  while (true) {
    try {
      const cdcApiRes = await axios.get(requestUrl, { headers: requestHeaders });

      logger.info(`CDC Internal API statusCode: ${cdcApiRes.status}`);
      let publisher: string | undefined = cdcApiRes.data.publisherFilter.publisher;
      let studyNumber: string | undefined = cdcApiRes.data.studyNumber;

      if (!publisher) {
        publisher = "NOT-FETCHED-CDC-PUBLISHER";
      }

      if (!studyNumber) {
        studyNumber = "NOT-FETCHED-CDC-STUDYNUMBER";
      }

      //add results to interface and return it
      return {
        publisher: publisher,
        studyNumber: studyNumber,
      };
    }
    catch (error) {
      if (retries++ < maxRetries) {
        logger.error(`Too many request retries on internal CDC API.`);
        dashLogger.error(`Too many request retries on internal CDC API, URL:${requestUrl}, time:${new Date().toUTCString()}`);
        return {
          publisher: "NOT-FETCHED-CDC-PUBLISHER",
          studyNumber: "NOT-FETCHED-CDC-STUDYNUMBER"
        };
      } else {
        logger.error(`Error at CDC Internal API Fetch: ${error}`);
        dashLogger.error(`Error at CDC Internal API Fetch: ${error}, URL:${requestUrl}, time:${new Date().toUTCString()}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
    }
  }
}
