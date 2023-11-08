import axios, { type AxiosResponse } from "axios";
import { logger, dashLogger } from "./logger.js";

export async function getFUJIResults(studyInfo: StudyInfo, base64UsernamePassword: string): Promise<JSON | string> {
    let fujiRes: AxiosResponse<any, any>;
    let fujiResults: any | string;
    let maxRetries: number = 10;
    let retries: number = 0;
    let success: boolean = false;
    while (retries <= maxRetries && !success) {
      try {
        fujiRes = await axios.post(process.env['FUJI_API_LOCAL']!, {
          "metadata_service_endpoint": "",
          "metadata_service_type": "",
          "object_identifier": studyInfo.url,
          "test_debug": false,
          "use_datacite": true,
          "auth_token": base64UsernamePassword,
          "auth_token_type": "Basic"
        }, {
          auth: {
            username: process.env['FUJI_USERNAME_LOCAL']!,
            password: process.env['FUJI_PASSWORD_LOCAL']!
          }
        });
        logger.info(`FUJI API statusCode: ${fujiRes.status}`);
        fujiResults = fujiRes.data;
        success = true;
      }
      catch (error) {
        if (axios.isAxiosError(error)) {
          logger.error(`AxiosError at FUJI API: ${error.message}, Response Status:${error.response?.status}, URL:${studyInfo.url}`);
          dashLogger.error(`AxiosError at FUJI API: ${error.message}, Response Status:${error.response?.status}, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
        }
        else {
          logger.error(`Error at FUJI API: ${error}, URL:${studyInfo.url}`);
          dashLogger.error(`Error at FUJI API: ${error}, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
      }
      retries++;
    }
    if(retries >= maxRetries){
      logger.error(`Too many  request retries on FUJI API.`);
      dashLogger.error(`Too many  request retries on FUJI API, URL:${studyInfo.url}, time:${new Date().toUTCString()}`);
      fujiResults = `Too many  request retries on FUJI API, URL:${studyInfo.url}, time:${new Date().toUTCString()}`;
      return fujiResults; //skip study assessment
    }
    //Delete scores and logs from response that are not needed
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
    fujiResults['dateID'] = "FujiRun-" + studyInfo.assessDate;
    // TODO: CHECK FOR OTHER SP'S URI PARAMS
    if (studyInfo.url?.includes("datacatalogue.cessda.eu") || studyInfo.url?.includes("datacatalogue-staging.cessda.eu")){
      fujiResults['uid'] = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + studyInfo.assessDate;
      fujiResults['pid'] = studyInfo.cdcStudyNumber;
    }
    else if(studyInfo.url?.includes("snd.gu.se") || studyInfo.url?.includes("adp.fdv.uni-lj")){
      fujiResults['uid'] = studyInfo.spID + "-" + studyInfo.assessDate;
      fujiResults['pid'] = studyInfo.spID;
    }
    else{ // Dataverse cases
      fujiResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate; 
      fujiResults['pid'] = studyInfo.urlParams?.get('persistentId');
    }
    return fujiResults;
  }