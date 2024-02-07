import axios, { type AxiosResponse } from "axios";
import { logger } from "./logger.js";
import { appendFileSync } from "fs";
import { base64UsernamePassword } from "./cdcStagingConn.js";
import type { StudyInfo } from "../types/studyinfo.js";

const maxRetries = 10;
const fujiEndpoint = process.env['FUJI_API_LOCAL'] || 'http://localhost:1071/fuji/api/v1/evaluate';


export async function getFUJIResults(studyInfo: StudyInfo): Promise<JSON | string> {
  let fujiRes: AxiosResponse<any, any>;
  let fujiResults: any | string;
  let retries: number = 0;
  for (;;) {
    try {
      fujiRes = await axios.post(fujiEndpoint, {
        "metadata_service_endpoint": "",
        "metadata_service_type": "",
        "object_identifier": studyInfo.url,
        "test_debug": true,
        "use_datacite": true,
        "auth_token": base64UsernamePassword,
        "auth_token_type": "Basic"
      }, {
        auth: {
          username: process.env['FUJI_USERNAME_LOCAL'] || "marvel",
          password: process.env['FUJI_PASSWORD_LOCAL'] || "wonderwoman"
        }
      });
      fujiResults = fujiRes.data;
      break;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error("AxiosError at FUJI API: %s, URL: %s", error.message, studyInfo.url);
      } else {
        logger.error("Error at FUJI API: %s, URL: %s", (error as Error).message,  studyInfo.url);
      }

      if (retries++ >= maxRetries) {
        appendFileSync('../outputs/failed.txt', studyInfo.url + '\n');
        throw new Error(`Too many request retries or code not 200 on FUJI API, URL: ${studyInfo.url}`);
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
      }
    }
  }

  //Delete scores and logs from response that are not needed
  //delete fujiResults['results']; - keep results for debug reasons
  delete fujiResults.summary.maturity;
  delete fujiResults.summary.score_earned;
  delete fujiResults.summary.score_total;
  delete fujiResults.summary.status_passed;
  delete fujiResults.summary.status_total;
  fujiResults['summary']['score_percent']['R1_1'] = fujiResults['summary']['score_percent']['R1.1'];
  delete fujiResults['summary']['score_percent']['R1.1'];
  fujiResults['summary']['score_percent']['R1_2'] = fujiResults['summary']['score_percent']['R1.2'];
  delete fujiResults['summary']['score_percent']['R1.2'];
  fujiResults['summary']['score_percent']['R1_3'] = fujiResults['summary']['score_percent']['R1.3'];
  delete fujiResults['summary']['score_percent']['R1.3'];
  fujiResults['publisher'] = studyInfo.publisher;
  fujiResults['dateID'] = "FujiRun-" + studyInfo.assessDate;
  // TODO: CHECK FOR OTHER SP'S URI PARAMS
  if (studyInfo.url.includes("datacatalogue.cessda.eu") || studyInfo.url.includes("datacatalogue-staging.cessda.eu")) {
    fujiResults['uid'] = studyInfo.urlParams.get('q') + "-" + studyInfo.urlParams.get('lang') + "-" + studyInfo.assessDate;
    fujiResults['pid'] = studyInfo.cdcStudyNumber;
  }
  else if (studyInfo.url.includes("snd.gu.se") || studyInfo.url.includes("adp.fdv.uni-lj")) {
    fujiResults['uid'] = studyInfo.spID + "-" + studyInfo.assessDate;
    fujiResults['pid'] = studyInfo.spID;
  }
  else { // Dataverse cases
    fujiResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate;
    fujiResults['pid'] = studyInfo.urlParams?.get('persistentId');
  }
  return fujiResults;
}
