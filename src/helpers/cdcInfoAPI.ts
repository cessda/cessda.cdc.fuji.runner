import axios from "axios";
import { logger } from "./logger.js";
import { requestHeaders } from "./cdcStagingConn.js";

const maxRetries = 10;

export async function getCDCApiInfo(id: string, lang: string, host: string) {

  const requestUrl = `https://${host}/api/json/cmmstudy_${lang}/${id}`;

  let retries: number = 0;
  for (;;) {
    try {
      const cdcApiRes = await axios.get(requestUrl, { headers: requestHeaders });

      logger.debug("CDC Internal API statusCode: %s", cdcApiRes.status);
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
      logger.error("Error at CDC Internal API Fetch: %s", error);

      if (retries++ >= maxRetries) {
        logger.error("Too many request retries on internal CDC API.");
        return {
          publisher: "NOT-FETCHED-CDC-PUBLISHER",
          studyNumber: "NOT-FETCHED-CDC-STUDYNUMBER"
        };
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
      }
    }
  }
}
