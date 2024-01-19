import { Readable } from 'stream';
import { getCDCApiInfo } from './cdcInfoAPI.js';
import { getFUJIResults } from './fujiAPI.js';
import { getEVAResults } from './evaAPI.js';
import { resultsToHDD } from './writeToFiles.js';
import { resultsToCSV } from './writeToCSV.js';
import { resultsToElastic } from './esFunctions.js';
import { mkdir } from 'fs/promises';
import { logger } from "./logger.js";
import type { StudyInfo } from '../types/studyinfo.js';

export async function getStudiesAssess(studiesAssessFiltered: string[], outputName: string): Promise<void> {
    //create date of testing
    const runDate = new Date();
    const assessDate = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
    //create directory for storing results per sitemap link
    await mkdir('../outputs/' + outputName, { recursive: true });
    //Initiating CSV writers
    const csvFUJI = new Readable({ objectMode: true });
    csvFUJI._read = () => { };
    const csvEVA = new Readable({ objectMode: true });
    csvEVA._read = () => { };
    // Begin API Loop for studies fetched
    for (const study of studiesAssessFiltered) {
        logger.info(`Processing study: ${study}`);
        const studyURL: URL = new URL(study);
        const url = study;
        const urlParams = studyURL.searchParams;
        const urlPath = studyURL.pathname.substring(1);

        let studyInfo: StudyInfo;

        //gather required variables, depending on SP
        switch(studyURL.hostname) {
            case "datacatalogue.cessda.eu":
            case "datacatalogue-staging.cessda.eu": {
                //get the study info from CDC Internal API
                const temp = await getCDCApiInfo(urlParams.get('q')!, urlParams.get('lang')!, studyURL.host);

                studyInfo = {
                    assessDate: assessDate,
                    cdcID: urlParams.get('q') || undefined,
                    spID: undefined,
                    fileName: urlParams.get('q') + "-" + urlParams.get('lang') + "-" + assessDate,
                    cdcStudyNumber: temp.studyNumber,
                    publisher: temp.publisher,
                    oaiLink: study.includes("datacatalogue.cessda.eu") ? "https://datacatalogue.cessda.eu/oai-pmh/v0/oai" : "https://datacatalogue-staging.cessda.eu/oai-pmh/v0/oai",
                    url: url,
                    urlParams: urlParams,
                    urlPath: urlPath,
                }
                break;
            }
            case "adp.fdv.uni-lj": {
                let pathArray: string[] = urlPath.split('/').map( x => x.toUpperCase() );
                studyInfo = {
                    assessDate: assessDate,
                    cdcID: undefined,
                    cdcStudyNumber: undefined,
                    spID: pathArray[pathArray.length - 2],
                    fileName: urlPath.replaceAll('/', '-') + "-" + assessDate,
                    publisher: studyURL.hostname,
                    oaiLink: "https://www.adp.fdv.uni-lj.si/v0/oai",
                    url: url,
                    urlParams: urlParams,
                    urlPath: urlPath,
                }
                break;
            }
            case "snd.gu.se": {
                const pathArray = urlPath.split('/');
                studyInfo = {
                    spID: pathArray[pathArray.length - 1],
                    fileName: urlPath.replaceAll('/', '-') + "-" + assessDate,
                    publisher: studyURL.hostname,
                    oaiLink: "https://snd.gu.se/en/oai-pmh",
                    assessDate: assessDate,
                    cdcID: undefined,
                    cdcStudyNumber: undefined,
                    url: url,
                    urlParams: urlParams,
                    urlPath: urlPath,
                }
                break;
            }
            default: {
                // Dataverse cases
                studyInfo = {
                    spID: urlParams.get('persistentId') || undefined,
                    fileName: (urlParams.get('persistentId') + "-" + assessDate).replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "-"),
                    publisher: studyURL.hostname,
                    oaiLink: `https://${studyURL.host}/oai`,
                    assessDate: assessDate,
                    cdcID: undefined,
                    cdcStudyNumber: undefined,
                    url: url,
                    urlParams: urlParams,
                    urlPath: urlPath,
                }
                break;
            }
        }
        //get simultaneously results from both EVA and FUJI API
        const evaPromise = getEVAResults(studyInfo);
        evaPromise.then(evaData => {
            exportData(dir, studyInfo.fileName + "-EVA", evaData);

            //Push EVA data to CSV writer
            csvEVA.push(evaData);
        });
        const fujiPromise = getFUJIResults(studyInfo);
        fujiPromise.then(fujiData => {
            exportData(dir, studyInfo.fileName + "-FUJI", fujiData);

            //Push FUJI data to CSV writer
            csvFUJI.push(fujiData); 
        });

        // Wait for the export to complete
        await Promise.allSettled([evaPromise, fujiPromise]);
    }
    //parse results to CSV
    resultsToCSV(csvEVA, outputName + "_" + assessDate, "EVA");
    resultsToCSV(csvFUJI, outputName + "_" + assessDate, "FUJI");
}

function exportData(dir: string, filename: string, data: string | JSON) {
    resultsToElastic(filename, data);
    resultsToHDD(dir, filename + ".json", data);
}
