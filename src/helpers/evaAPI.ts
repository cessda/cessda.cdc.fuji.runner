import axios, { type AxiosResponse } from "axios";
import { logger } from "./logger.js";
import { appendFile } from "fs";
import type { StudyInfo } from "../types/studyinfo.js";

const maxRetries = 10;

const evaEndpoint = process.env['EVA_API_LOCAL'] || "http://localhost:9090/v1.0/rda/rda_all";

export async function getEVAResults(studyInfo: StudyInfo): Promise<JSON | string> {
  let evaResponse: AxiosResponse<any, any>;
  let evaResults: any;
  let retries: number = 0;
  // TODO: NEED OAI + CDC IDENTIFIER IF CDC RECORD
  for (;;) {
    try {
      evaResponse = await axios.post(evaEndpoint, {
        "id": studyInfo.cdcID != null ? studyInfo.cdcID : studyInfo.spID,
        "lang": "en",
        "oai_base": studyInfo.oaiLink,
        "repo": "oai-pmh",
      });
      logger.info(`EVA API statusCode: ${evaResponse.status}`);
      evaResults = evaResponse.data;
      break;
    }
    catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error("AxiosError at EVA API: %s, URL: %s", error.message, studyInfo.url);
      } else {
        logger.error("Error at EVA API: %s, URL: %s", error, studyInfo.url);
      }

      if (retries++ >= maxRetries) {
        appendFile('../outputs/failed.txt', studyInfo.url + '\n', () => {});
        throw new Error(`Too many request retries or code not 200 on EVA API, URL: ${studyInfo.url}`);
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
      }
    }
  }
  
  //TODO: overall FAIR score not available in response while developing. Getting it manually - console.log(JSON.stringify(evaObjResults,null,'\t'));
  const evaObjResults = getTotals(JSON.parse(evaResults));
  //Delete or Add scores and logs from response that are not needed
  evaObjResults['studyURL'] = studyInfo.url;
  evaObjResults['publisher'] = studyInfo.publisher;
  evaObjResults['dateID'] = "EVARun-" + studyInfo.assessDate;
  // TODO: CHECK FOR OTHER SP'S URI PARAMS
  if (studyInfo.url.hostname === "datacatalogue.cessda.eu" || studyInfo.url.hostname === "datacatalogue-staging.cessda.eu") {
    evaObjResults['uid'] = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + studyInfo.assessDate;
    evaObjResults['pid'] = studyInfo.cdcStudyNumber;
  }
  else if (studyInfo.url.hostname === "snd.gu.se" || studyInfo.url.hostname === "adp.fdv.uni-lj") {
    evaObjResults['uid'] = studyInfo.spID + "-" + studyInfo.assessDate;
    evaObjResults['pid'] = studyInfo.spID;
  }
  else { // Dataverse cases
    evaObjResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate;
    evaObjResults['pid'] = studyInfo.urlParams?.get('persistentId');
  }
  return evaObjResults;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTotals(objTotals: any) {
  let result_points: number = 0;
  let weight_of_tests: number = 0;
  Object.keys(objTotals).forEach(key => {
    let g_weight: number = 0;
    let g_points: number = 0;
    for (const kk in objTotals[key]) {
      const weight: number = objTotals[key][kk]['score']['weight'];
      weight_of_tests += weight;
      g_weight += weight;
      result_points += objTotals[key][kk]['points'] * weight;
      g_points += objTotals[key][kk]['points'] * weight
    }
    objTotals["Total" + key] = g_points / g_weight;
  });
  objTotals['TotalFAIR'] = result_points / weight_of_tests;

  return objTotals;
}
