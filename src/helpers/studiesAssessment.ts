import { Readable } from 'stream';
import { getCDCApiInfo } from './cdcInfoAPI.js';
import { getFUJIResults } from './fujiAPI.js';
import { resultsToHDD } from './writeToFiles.js';
import { resultsToCSV } from './writeToCSV.js';
import { resultsToElastic } from './esFunctions.js';
import { mkdir } from 'fs/promises';
import { logger } from "./logger.js";
import type { StudyInfo } from '../types/studyinfo.js';

export async function getStudiesAssess(studiesAssessFiltered: URL[], outputName: string): Promise<void> {
    //create date of testing
    const runDate = new Date();
    const assessDate = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
    //create directory for storing results per sitemap link
    const dir = '../outputs/' + outputName;
    await mkdir(dir, { recursive: true });
    //Initiating CSV writers
    const csvFUJI = new Readable({ objectMode: true });
    csvFUJI._read = () => { };
    //const csvEVA = new Readable({ objectMode: true });
    //csvEVA._read = () => { };
    // Begin API Loop for studies fetched
    for (const study of studiesAssessFiltered) {
        logger.info("Processing study: %s", study);

        //gather required variables, depending on SP
        const studyInfo = await getStudyInfo(study, assessDate);

        //get simultaneously results from both EVA and FUJI API
        // const evaPromise = getEVAResults(studyInfo);
        // evaPromise.then(evaData => {
        //     exportData(dir, studyInfo.fileName + "-EVA", evaData);

        //     //Push EVA data to CSV writer
        //     csvEVA.push(evaData);
        // }).catch(err => {
        //     logger.error("Failed to assess %s with EVA:\n%s", studyInfo.fileName, err);
        // });
        const fujiPromise = getFUJIResults(studyInfo);
        fujiPromise.then(fujiData => {
            exportData(dir, studyInfo.fileName + "-FUJI", fujiData);

            //Push FUJI data to CSV writer
            csvFUJI.push(fujiData); 
        }).catch(err => {
            logger.error("Failed to assess %s with FUJI:\n%s", studyInfo.fileName, err);
        });

        // Wait for the export to complete
        await Promise.allSettled([fujiPromise]);
    }
    //parse results to CSV
    //resultsToCSV(csvEVA, outputName + "_" + assessDate, "EVA");
    resultsToCSV(csvFUJI, outputName + "_" + assessDate, "FUJI");
}

async function getStudyInfo(studyURL: URL, assessDate: string): Promise<StudyInfo> {
    const urlParams = studyURL.searchParams;
    const urlPath = studyURL.pathname.substring(1);

    switch (studyURL.hostname) {
        case "datacatalogue.cessda.eu":
        case "datacatalogue-staging.cessda.eu": {
            //call to CDC Internal API to obtain study number & publisher
            const cdcID = studyURL.pathname.replace(/\/+$/, "").split("/").pop()!;
            const temp = await getCDCApiInfo(cdcID!, urlParams.get('lang')!, studyURL.host);
            return {
                assessDate: assessDate,
                cdcID: cdcID || undefined,
                spID: undefined,
                fileName: cdcID + "-" + urlParams.get('lang') + "-" + assessDate,
                cdcStudyNumber: temp.studyNumber,
                publisher: temp.publisher,
                oaiLink: studyURL.host === "datacatalogue.cessda.eu" ? "https://datacatalogue.cessda.eu/oai-pmh/v0/oai" : "https://datacatalogue-staging.cessda.eu/oai-pmh/v0/oai",
                url: studyURL,
                urlParams: urlParams,
                urlPath: urlPath,
            };
        }
        case "adp.fdv.uni-lj": {
            const pathArray: string[] = urlPath.split('/').map(x => x.toUpperCase());
            return {
                assessDate: assessDate,
                cdcID: undefined,
                cdcStudyNumber: undefined,
                spID: pathArray[pathArray.length - 2],
                fileName: urlPath.replaceAll('/', '-') + "-" + assessDate,
                publisher: studyURL.hostname,
                oaiLink: "https://www.adp.fdv.uni-lj.si/v0/oai",
                url: studyURL,
                urlParams: urlParams,
                urlPath: urlPath,
            };
        }
        case "snd.gu.se": {
            const pathArray = urlPath.split('/');
            return {
                spID: pathArray[pathArray.length - 1],
                fileName: urlPath.replaceAll('/', '-') + "-" + assessDate,
                publisher: studyURL.hostname,
                oaiLink: "https://snd.gu.se/en/oai-pmh",
                assessDate: assessDate,
                cdcID: undefined,
                cdcStudyNumber: undefined,
                url: studyURL,
                urlParams: urlParams,
                urlPath: urlPath,
            };
        }
        default:
            // Dataverse cases
            return {
                spID: urlParams.get('persistentId') || undefined,
                fileName: (urlParams.get('persistentId') + "-" + assessDate).replace(/[&/\\#,+()$~%'":*?<>{}]/g, "-"),
                publisher: studyURL.hostname,
                oaiLink: `https://${studyURL.host}/oai`,
                assessDate: assessDate,
                cdcID: undefined,
                cdcStudyNumber: undefined,
                url: studyURL,
                urlParams: urlParams,
                urlPath: urlPath,
            };
    }
}

function exportData(dir: string, filename: string, data: string | JSON) {
    resultsToElastic(filename, data);
    resultsToHDD(dir, filename + ".json", data);
}
