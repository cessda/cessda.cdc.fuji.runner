import { Readable } from 'stream';
import { getCDCApiInfo } from './cdcInfoAPI.js';
import { getFUJIResults } from './fujiAPI.js';
import { getEVAResults } from './evaAPI.js';
import { resultsToHDD } from './writeToFiles.js';
import { resultsToCSV } from './writeToCSV.js';
import { resultsToElastic } from './esFunctions.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { logger } from "./logger.js";

export async function getStudiesAssess(studiesAssessFiltered: string[], outputName: string): Promise<void> {
    //create date of testing
    const runDate = new Date();
    const assessDate = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
    //create directory for storing results per sitemap link
    let dir: string = '../outputs/' + outputName;
    mkdirSync(dir, { recursive: true });
    //create logfile failed.txt for storing failed study assesses
    if (!existsSync('../outputs/failed.txt'))
        writeFileSync('../outputs/failed.txt', "", { flag: 'ax' });
    //Initiating CSV writers
    const csvFUJI = new Readable({ objectMode: true });
    csvFUJI._read = () => { };
    const csvEVA = new Readable({ objectMode: true });
    csvEVA._read = () => { };
    // Begin API Loop for studies fetched
    for (const study of studiesAssessFiltered) {
        logger.info(`Processing study: ${study}`);
        const studyURL: URL = new URL(study);
        let studyInfo: StudyInfo = {};
        studyInfo.assessDate = assessDate
        studyInfo.url = study;
        studyInfo.urlParams = studyURL.searchParams;
        studyInfo.urlPath = studyURL.pathname.substring(1);
        //gather required variables, depending on SP
        if (study.includes("datacatalogue.cessda.eu") || study.includes("datacatalogue-staging.cessda.eu")) {
            //get the study info from CDC Internal API
            studyInfo.fileName = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + studyInfo.assessDate;
            studyInfo.cdcID = studyInfo.urlParams?.get('q');
            const temp: StudyInfo = await getCDCApiInfo(studyInfo);
            studyInfo.publisher = temp.publisher;
            studyInfo.cdcStudyNumber = temp.cdcStudyNumber;
            studyInfo.oaiLink = study.includes("datacatalogue.cessda.eu") ? "https://datacatalogue.cessda.eu/oai-pmh/v0/oai" : "https://datacatalogue-staging.cessda.eu/oai-pmh/v0/oai";
        }
        else if (study.includes("adp.fdv.uni-lj")) {
            let pathArray: string[] = studyInfo.urlPath.split('/');
            pathArray = pathArray.map(function (x) { return x.toUpperCase(); })
            studyInfo.spID = pathArray[pathArray.length - 2];
            studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-') + "-" + studyInfo.assessDate;
            studyInfo.publisher = studyURL.hostname;
            studyInfo.oaiLink = "https://www.adp.fdv.uni-lj.si/v0/oai";
        }
        else if (study.includes("snd.gu.se")) {
            let pathArray: string[] = studyInfo.urlPath.split('/');
            studyInfo.spID = pathArray[pathArray.length - 1]
            studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-') + "-" + studyInfo.assessDate;
            studyInfo.publisher = studyURL.hostname;
            studyInfo.oaiLink = "https://snd.gu.se/en/oai-pmh";
        }
        else { // Dataverse cases
            studyInfo.spID = studyInfo.urlParams?.get('persistentId');
            studyInfo.fileName = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate;
            studyInfo.fileName = studyInfo.fileName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "-");
            studyInfo.publisher = studyURL.hostname;
            switch (studyURL.hostname) {
                case "data.aussda.at":
                    studyInfo.oaiLink = "https://data.aussda.at/oai";
                    break;
                case "datacatalogue.sodanet.gr":
                    studyInfo.oaiLink = "https://datacatalogue.sodanet.gr/oai";
                    break;
                case "ssh.datastations.nl":
                    studyInfo.oaiLink = "https://ssh.datastations.nl/oai";
                    break;
                case "www.sodha.be":
                    studyInfo.oaiLink = "https://www.sodha.be/oai";
                    break;
            }
        }
        //get simultaneously results from both EVA and FUJI API
        let [tempEvaData, tempFujiData] = await Promise.allSettled([getEVAResults(studyInfo), getFUJIResults(studyInfo)]);
        const evaData: string | JSON = tempEvaData.status == "fulfilled" ? tempEvaData.value : "rejected"
        const fujiData: string | JSON = tempFujiData.status == "fulfilled" ? tempFujiData.value : "rejected"
        //const evaData: string | JSON = await getEVAResults(studyInfo); //get results ONLY from EVA API
        //const fujiData: string | JSON = await getFUJIResults(studyInfo); //get results ONLY from FUJI API
        resultsToElastic(studyInfo.fileName + "-EVA", evaData);
        resultsToHDD(dir, studyInfo.fileName + "-EVA.json", evaData);
        resultsToElastic(studyInfo.fileName + "-FUJI", fujiData);
        resultsToHDD(dir, studyInfo.fileName + "-FUJI.json", fujiData);
        csvEVA.push(evaData); //Push EVA data to CSV writer
        csvFUJI.push(fujiData); //Push FUJI data to CSV writer
    }
    //parse results to CSV
    resultsToCSV(csvEVA, outputName + "_" + assessDate, "EVA");
    resultsToCSV(csvFUJI, outputName + "_" + assessDate, "FUJI");
}