import axios, { type AxiosResponse } from "axios";
import { logger, dashLogger } from "../logger.js";

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
          "id": "10.17903/FK2/YZD8DP",
          "lang": "en",
          "oai_base": "https://datacatalogue.sodanet.gr/oai",
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
    if(retries >= maxRetries){
      logger.error(`Too many  request retries on EVA API.`);
      dashLogger.error(`Too many  request retries on EVA API, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
      evaResults = `Too many  request retries on EVA API, URL:${studyInfo.url}, time:${new Date().toUTCString()}`;
      return evaResults; //skip study assessment
    }
    //Do something with the actual data...
    /*
    delete fujiResults['results'];
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
    fujiResults['dateID'] = "FujiRun-" + fullDate;
    // TODO: CHECK FOR OTHER SP'S URI PARAMS
    if (studyInfo.url?.includes("datacatalogue.cessda.eu") || studyInfo.url?.includes("datacatalogue-staging.cessda.eu")){
      fujiResults['uid'] = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + fullDate;
      fujiResults['pid'] = studyInfo.studyNumber;
    }
    else if(studyInfo.url?.includes("snd.gu.se") || studyInfo.url?.includes("adp.fdv.uni-lj")){
      //fujiResults['uid'] = studyInfo.urlPath?.replaceAll('/', '-') + "-" + fullDate;
      fujiResults['uid'] = studyInfo.urlPath + "-" + fullDate;
      fujiResults['pid'] = studyInfo.urlPath;
    }
    else{ // Dataverse cases
      fujiResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + fullDate; 
      fujiResults['pid'] = studyInfo.urlParams?.get('persistentId');
    }
    */
    return evaResults;
  }