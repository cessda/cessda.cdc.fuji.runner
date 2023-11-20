import axios, { type AxiosResponse } from "axios";
import { logger, dashLogger } from "./logger.js";
import { writeFileSync } from "fs";
import test from "node:test";

export async function getEVAResults(studyInfo: StudyInfo): Promise<JSON | string> {
  let evaResponse: AxiosResponse<any, any>;
  let evaResults: any | string;
  let maxRetries: number = 10;
  let retries: number = 0;
  let success: boolean = false;
  // TODO: NEED OAI + CDC IDENTIFIER IF CDC RECORD
  while (retries <= maxRetries && !success) {
    try {
      evaResponse = await axios.post(process.env['EVA_API_LOCAL']!, {
        "id": studyInfo.cdcID != null ? studyInfo.cdcID : studyInfo.spID,
        "lang": "en",
        "oai_base": studyInfo.oaiLink,
        "repo": "oai-pmh",
      });
      logger.info(`EVA API statusCode: ${evaResponse.status}`);
      evaResults = evaResponse.data;
      success = true;
    }
    catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`AxiosError at EVA API: ${error.message}, Response Status:${error.response?.status}, URL:${studyInfo.url}`);
        dashLogger.error(`AxiosError at EVA API: ${error.message}, Response Status:${error.response?.status}, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
      }
      else {
        logger.error(`Error at EVA API: ${error}, URL:${studyInfo.url}`);
        dashLogger.error(`Error at EVA API: ${error}, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
    }
    retries++;
  }
  if (retries >= maxRetries) {
    logger.error(`Too many  request retries on EVA API.`);
    dashLogger.error(`Too many  request retries on EVA API, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
    writeFileSync('../outputs/failed.txt', studyInfo.url! + '\n', { flag: 'ax' });
    evaResults = `Too many  request retries on EVA API, URL:${studyInfo.url}, time:${new Date().toUTCString()}`;
    return evaResults; //skip study assessment
  }
  //TODO: overall FAIR score??? - console.log(JSON.stringify(evaObjResults,null,'\t'));
  let evaObjResults: JSON | any = getTotals(JSON.parse(evaResults));
  //Delete or Add scores and logs from response that are not needed
  evaObjResults['studyURL'] = studyInfo.url;
  evaObjResults['publisher'] = studyInfo.publisher;
  evaObjResults['dateID'] = "EVARun-" + studyInfo.assessDate;
  // TODO: CHECK FOR OTHER SP'S URI PARAMS
  if (studyInfo.url?.includes("datacatalogue.cessda.eu") || studyInfo.url?.includes("datacatalogue-staging.cessda.eu")) {
    evaObjResults['uid'] = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + studyInfo.assessDate;
    evaObjResults['pid'] = studyInfo.cdcStudyNumber;
  }
  else if (studyInfo.url?.includes("snd.gu.se") || studyInfo.url?.includes("adp.fdv.uni-lj")) {
    //evaObjResults['uid'] = studyInfo.urlPath?.replaceAll('/', '-') + "-" + fullDate;
    evaObjResults['uid'] = studyInfo.spID + "-" + studyInfo.assessDate;
    evaObjResults['pid'] = studyInfo.spID;
  }
  else { // Dataverse cases
    evaObjResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate;
    evaObjResults['pid'] = studyInfo.urlParams?.get('persistentId');
  }
  return evaObjResults;
}

function getTotals(objTotals: JSON | any) : JSON | any{
  let result_points: number = 0;
  let weight_of_tests: number = 0;
  Object.keys(objTotals).forEach(key => {
    let g_weight: number = 0;
    let g_points: number = 0;
    for (let kk in objTotals[key]) {
      let weight: number = objTotals[key][kk]['score']['weight']
      weight_of_tests += weight;
      g_weight += weight;
      result_points += objTotals[key][kk]['points'] * weight;
      g_points += objTotals[key][kk]['points'] * weight
    }
    objTotals["Total"+key] = +(g_points / g_weight).toFixed(3);
  });
  objTotals['TotalFAIR'] = +(result_points / weight_of_tests).toFixed(2);

  return objTotals;
}