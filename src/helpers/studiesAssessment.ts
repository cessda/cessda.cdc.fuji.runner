import { Readable } from 'stream';
import { getCDCApiInfo } from './cdcInfoAPI.js';
import { getFUJIResults } from './fujiAPI.js';
import { getEVAResults } from './evaAPI.js';
import { resultsToHDD, uploadFromMemory } from './writeToFiles.js';
import { resultsToCSV } from './writeToCSV.js';
import { resultsToElastic } from './esFunctions.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { logger } from "./logger.js";

//To use if testing against CDC staging
const cdcusername = process.env['CDC_USERNAME'];
const cdcpassword = process.env['CDC_PASSWORD'];

const usernamePasswordBuffer = Buffer.from(
    `${cdcusername}:${cdcpassword}`,
    "utf-8"
);
const base64UsernamePassword = usernamePasswordBuffer.toString("base64");
const requestHeaders = {
    Authorization: `Basic ${base64UsernamePassword}`,
};

export async function getStudiesAssess(studiesAssessFiltered: string[], hostname: string): Promise<void> {
    //create date of testing
    const runDate = new Date();
    const assessDate = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
    //create directory for storing results per sitemap link
    let dir: string = '../outputs/' + hostname;
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    //create logfile failed.txt for storing failed study assesses
    if (!existsSync('../outputs/failed.txt'))
        writeFileSync('../outputs/failed.txt', "", { flag: 'ax' });
    //Initiating CSV writer
    const csvFUJI = new Readable({ objectMode: true });
    const csvEVA = new Readable({ objectMode: true });
    csvFUJI._read = () => { };
    csvEVA._read = () => { };
    // Begin API Loop for studies fetched
    for (const site of studiesAssessFiltered) {
        logger.info(`Processing study: ${site}`);
        const urlLink: URL = new URL(site);
        let studyInfo: StudyInfo = {};
        studyInfo.assessDate = assessDate
        studyInfo.url = site;
        studyInfo.urlParams = urlLink.searchParams;
        studyInfo.urlPath = urlLink.pathname.substring(1);
        //gather required variables, depending on SP
        if (site.includes("datacatalogue.cessda.eu") || site.includes("datacatalogue-staging.cessda.eu")) {
            //get the study info from CDC Internal API
            studyInfo.fileName = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + studyInfo.assessDate;
            studyInfo.cdcID = studyInfo.urlParams?.get('q');
            const temp: StudyInfo = await getCDCApiInfo(studyInfo, requestHeaders);
            studyInfo.publisher = temp.publisher;
            studyInfo.cdcStudyNumber = temp.cdcStudyNumber;
            studyInfo.oaiLink = site.includes("datacatalogue.cessda.eu") ? "https://datacatalogue.cessda.eu/oai-pmh/v0/oai" : "https://datacatalogue-staging.cessda.eu/oai-pmh/v0/oai";
        }
        else if (site.includes("adp.fdv.uni-lj")) {
            let pathArray: string[] = studyInfo.urlPath.split('/');
            pathArray = pathArray.map(function (x) { return x.toUpperCase(); })
            studyInfo.spID = pathArray[pathArray.length - 2];
            studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-');
            studyInfo.publisher = urlLink.hostname;
            studyInfo.oaiLink = "https://www.adp.fdv.uni-lj.si/v0/oai";
        }
        else if (site.includes("snd.gu.se")) {
            let pathArray: string[] = studyInfo.urlPath.split('/');
            studyInfo.spID = pathArray[pathArray.length - 1]
            studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-');
            studyInfo.publisher = urlLink.hostname;
            studyInfo.oaiLink = "https://snd.gu.se/en/oai-pmh";
        }
        else { // Dataverse cases
            studyInfo.spID = studyInfo.urlParams?.get('persistentId');
            studyInfo.fileName = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate;
            studyInfo.fileName = studyInfo.fileName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "-");
            studyInfo.publisher = urlLink.hostname;
            switch (urlLink.hostname) {
                case "data.aussda.at":
                    studyInfo.oaiLink = "https://data.aussda.at/oai";
                    break;
                case "datacatalogue.sodanet.gr":
                    studyInfo.oaiLink = "https://datacatalogue.sodanet.gr/oai";
                    break;
                case "ssh.datastations.nl":
                    studyInfo.oaiLink = "https://ssh.datastations.nl/oai";
                    break;
                case "sodha.be":
                    studyInfo.oaiLink = "https://www.sodha.be/oai";
                    break;
            }
        }
        //get results from EVA and FUJI API
        let [evaData, fujiData] = await Promise.allSettled([getEVAResults(studyInfo), getFUJIResults(studyInfo, base64UsernamePassword)]);
        //const fujiData1: JSON | string = await getFUJIResults(studyInfo, base64UsernamePassword); //get results from FUJI API
        resultsToElastic(studyInfo.fileName + "-EVA", evaData);
        resultsToHDD(dir, studyInfo.fileName + "-EVA.json", evaData);
        resultsToElastic(studyInfo.fileName + "-FUJI", fujiData);
        resultsToHDD(dir, studyInfo.fileName + "-FUJI.json", fujiData);
        //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function
        csvFUJI.push(fujiData); //Push FUJI data to CSV writer
        csvEVA.push(evaData); //Push EVA data to CSV writer
    }
    //parse results to CSV
    resultsToCSV(csvFUJI, csvEVA, hostname + "_" + assessDate);
}