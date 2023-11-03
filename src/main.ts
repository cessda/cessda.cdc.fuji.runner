import * as dotenv from 'dotenv'
import * as fsPromise from 'fs/promises';
import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import { URL } from 'url';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { Transform } from "json2csv";
import { parseAsync } from "json2csv";
import { Readable } from 'stream';
import { dashLogger, logger } from "./helpers/logger.js";
import { getCDCApiInfo } from './helpers/cdcInfoAPI.js';
import { getFUJIResults } from './helpers/fujiAPI.js';
import { getEVAResults } from './helpers/evaAPI.js';
import { elasticIndexCheck, resultsToElastic } from './helpers/esFunctions.js';
import { resultsToHDD, uploadFromMemory } from './helpers/writeToFiles.js';
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
    else if(site.includes("snd.gu.se") || site.includes("adp.fdv.uni-lj")){
      studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-')+".json";
      studyInfo.publisher = hostname;
    }
    else{ // Dataverse cases
      studyInfo.spID = studyInfo.urlParams?.get('persistentId');
      studyInfo.fileName = studyInfo.urlParams?.get('persistentId') + "-" + studyInfo.assessDate + ".json";
      studyInfo.fileName = studyInfo.fileName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g,"-");
      studyInfo.publisher = hostname;
    }
    //TODO: await 1 promise for both fujiResults and FAIREva results
    let [evaData, fujiData] = await Promise.allSettled([getEVAResults(studyInfo), getFUJIResults(studyInfo, base64UsernamePassword)]);
    //const fujiData: JSON | string = await getFUJIResults(studyInfo, base64UsernamePassword);
    resultsToElastic("FUJI-"+studyInfo.fileName, fujiData);
    resultsToElastic("EVA-"+studyInfo.fileName, evaData);
    resultsToHDD(dir, "FUJI-"+studyInfo.fileName, fujiData);
    resultsToHDD(dir, "EVA-"+studyInfo.fileName, evaData);
    //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function
    csvFUJI.push(fujiData); //Push FUJI data to CSV writer
    csvEVA.push(evaData); //Push EVA data to CSV writer
  }
  
  //prepare results to be parsed to csv
  csvFUJI.push(null);
  csvEVA.push(null);
  const fujiOutputLocal = createWriteStream(`../outputs/CSV-FUJI_${hostname}_${studyInfo.assessDate}.csv`, { encoding: 'utf8' });
  let fields = [
    'request.object_identifier',
    'summary.score_percent.A',
    'summary.score_percent.A1',
    'summary.score_percent.F',
    'summary.score_percent.F1',
    'summary.score_percent.F2',
    'summary.score_percent.F3',
    'summary.score_percent.F4',
    'summary.score_percent.FAIR',
    'summary.score_percent.I',
    'summary.score_percent.I1',
    'summary.score_percent.I2',
    'summary.score_percent.I3',
    'summary.score_percent.R',
    "summary.score_percent.R1",
    'summary.score_percent.R1_1',
    'summary.score_percent.R1_2',
    'summary.score_percent.R1_3',
    'timestamp',
    'publisher',
    'uid',
    'pid'
  ];
  let opts = { fields };
  let transformOpts = { objectMode: true };
  let json2csv = new Transform(opts, transformOpts);
  let processor = csvFUJI.pipe(json2csv).pipe(fujiOutputLocal);
  try {
    await parseAsync(processor, opts);
  } catch (err) {
    logger.error(`CSV writer Error: ${err}`)
  }
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