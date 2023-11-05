import * as dotenv from 'dotenv'
import * as fsPromise from 'fs/promises';
import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import { URL } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { Readable } from 'stream';
import { dashLogger, logger } from "./helpers/logger.js";
import { getCDCApiInfo } from './helpers/cdcInfoAPI.js';
import { getFUJIResults } from './helpers/fujiAPI.js';
import { getEVAResults } from './helpers/evaAPI.js';
import { elasticIndexCheck, resultsToElastic } from './helpers/esFunctions.js';
import { resultsToHDD, uploadFromMemory } from './helpers/writeToFiles.js';
import { resultsToCSV } from './helpers/writeToCSV.js';
dotenv.config({ path: '../.env' })

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

async function apiRunner(sitemapLine: URL): Promise<void> {
  const hostname = sitemapLine.hostname;
  //create date of testing
  const runDate = new Date();
  let studyInfo: StudyInfo = {
    assessDate: [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-')
  };
  //prepare request for gathering all url's existing on sitemap
  const cdcLinks = new Sitemapper({
    url: sitemapLine.toString(),
    timeout: 5000, // 5 seconds,
    requestHeaders
  });
  let sitemapRes: SitemapperResponse | undefined;
  try {
    sitemapRes = await cdcLinks.fetch();
  }
  catch (error) {
    logger.error(`Error at sitemapper fetch: ${error}`);
    dashLogger.error(`Error at sitemapper fetch: ${error} Sitemapper Error: ${sitemapRes?.errors}, time:${new Date().toUTCString()}`);
    return;
  }
  logger.info(`Links Collected: ${sitemapRes.sites.length}`);
  // TODO: `REMOVE URL's THAT DONT CONTAIN STUDIES (IDENTIFIER IN URL) + INCLUDE OAI LINK
  let sitemapResFiltered: string[] = [];
  switch (hostname) {
    case "data.aussda.at": {
      studyInfo.oaiLink = "https://data.aussda.at/oai";
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      }); 
    }
    break;
    case "datacatalogue.sodanet.gr": {
      studyInfo.oaiLink = "https://datacatalogue.sodanet.gr/oai";
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    }
    break;
    case "ssh.datastations.nl": {
      studyInfo.oaiLink = "https://ssh.datastations.nl/oai";
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    }
    break;
    case "sodha.be": {
      studyInfo.oaiLink = "https://www.sodha.be/oai";
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    }
    break;
    case "datacatalogue.cessda.eu": {
      studyInfo.oaiLink = "https://datacatalogue.cessda.eu/oai-pmh/v0/oai";
      sitemapResFiltered = sitemapRes.sites.filter(temp => temp !== 'https://datacatalogue.cessda.eu/');
    }
    break;
    case "datacatalogue-staging.cessda.eu": {
      studyInfo.oaiLink = "https://datacatalogue-staging.cessda.eu/oai-pmh/v0/oai";
      sitemapResFiltered = sitemapRes.sites.filter(temp => temp !== 'https://datacatalogue-staging.cessda.eu/');
    }
    break;
    case "www.adp.fdv.uni-lj.si": {
      studyInfo.oaiLink = "https://www.adp.fdv.uni-lj.si/v0/oai";
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("opisi");
      });
    }
    break;
    case "snd.gu.se": {
      studyInfo.oaiLink = "https://snd.gu.se/en/oai-pmh";
      sitemapResFiltered = sitemapRes.sites;
    }
    break;
  }
  //create directory for storing results per sitemap link
  let dir: string = '../outputs/'+hostname;
  if (!existsSync(dir))
    mkdirSync(dir, { recursive: true });
  //Initiating CSV writer
  const csvFUJI = new Readable({ objectMode: true });
  const csvEVA = new Readable({ objectMode: true });
  csvFUJI._read = () => { };
  csvEVA._read = () => { };

  // Begin API Loop for studies fetched
  for (const site of sitemapResFiltered) {
    logger.info(`Processing study: ${site}`);
    const urlLink: URL = new URL(site);
    studyInfo.url = site;
    studyInfo.urlParams = urlLink.searchParams;
    studyInfo.urlPath = urlLink.pathname.substring(1);
    //gather required variables, depending on SP
    if (site.includes("datacatalogue.cessda.eu") || site.includes("datacatalogue-staging.cessda.eu")){  //get the publisher + studyNumber from CDC Internal API
      studyInfo.fileName = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + studyInfo.assessDate + ".json";
      studyInfo.cdcID = studyInfo.urlParams?.get('q');
      const temp: StudyInfo = await getCDCApiInfo(studyInfo, requestHeaders);
      studyInfo.publisher = temp.publisher;
      studyInfo.cdcStudyNumber = temp.cdcStudyNumber;
    }
    else if(site.includes("adp.fdv.uni-lj")){
      let pathArray: string[] = studyInfo.urlPath.split('/');
      studyInfo.spID = pathArray[pathArray.length-2]
      studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-')+".json";
      studyInfo.publisher = hostname;
    }
    else if(site.includes("snd.gu.se")){
      let pathArray: string[] = studyInfo.urlPath.split('/');
      studyInfo.spID = pathArray[pathArray.length-1]
      studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-')+".json";
      studyInfo.publisher = hostname;
    }
    else{ // Dataverse cases
      studyInfo.spID = studyInfo.urlParams?.get('persistentId');
      studyInfo.fileName = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate + ".json";
      studyInfo.fileName = studyInfo.fileName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g,"-");
      studyInfo.publisher = hostname;
    }
    //get results from EVA and FUJI API
    let [evaData, fujiData] = await Promise.allSettled([getEVAResults(studyInfo), getFUJIResults(studyInfo, base64UsernamePassword)]);
    resultsToElastic("EVA-"+studyInfo.fileName, evaData);
    resultsToHDD(dir, "EVA-"+studyInfo.fileName, evaData);
    resultsToElastic("FUJI-"+studyInfo.fileName, fujiData);
    resultsToHDD(dir, "FUJI-"+studyInfo.fileName, fujiData);
    //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function
    csvFUJI.push(fujiData); //Push FUJI data to CSV writer
    csvEVA.push(evaData); //Push EVA data to CSV writer
  }
  
  //parse results to CSV
  resultsToCSV(csvFUJI, csvEVA, hostname, studyInfo.assessDate);
  logger.info(`Finished sitemap: ${sitemapLine}`);
  dashLogger.info(`Finished sitemap: ${sitemapLine}, time:${new Date().toUTCString()}`);
};

//START SCRIPT EXECUTION
logger.info('Start of Script');
dashLogger.info(`Start of Script, time:${new Date().toUTCString()}`);
//creates ES index if it doesnt exist, skips creating if it does exist
await elasticIndexCheck();
const file = await fsPromise.open('../inputs/sitemapsRUN.txt', 'r');
for await (const sitemapLine of file.readLines()) {
  logger.info(`Processing sitemap: ${sitemapLine}`);
  dashLogger.info(`Processing sitemap: ${sitemapLine}, time:${new Date().toUTCString()}`);
  await apiRunner(new URL(sitemapLine));
}
logger.info('End of Script');
dashLogger.info(`End of Script, time:${new Date().toUTCString()}`);