import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import { URL } from 'url';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { Transform } from "json2csv";
import { parseAsync } from "json2csv";
import { Readable } from 'stream';
import * as dotenv from 'dotenv'
import * as fsPromise from 'fs/promises';
import { dashLogger, logger } from "./logger.js";
import { getCDCApiInfo } from './helpers/cdcInfoAPI.js';
import { getFUJIResults } from './helpers/fujiAPI.js';
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
  //prepare request for gathering all study links
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
  // TODO: `REMOVE RECORDS THAT DONT CONTAIN DOI IN URL + NEED TO CHECK FOR OTHER SP DOI REFERENCES + CESSDA
  let sitemapResFiltered: string[] = [];
  switch (hostname) {
    case "data.aussda.at":
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    break;
    case "datacatalogue.sodanet.gr":
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    break;
    case "ssh.datastations.nl":
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    break;
    case "sodha.be":
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("persistentId");
      });
    break;
    case "datacatalogue.cessda.eu":
      sitemapResFiltered = sitemapRes.sites.filter(temp => temp !== 'https://datacatalogue.cessda.eu/');
    break;
    case "datacatalogue-staging.cessda.eu":
      sitemapResFiltered = sitemapRes.sites.filter(temp => temp !== 'https://datacatalogue-staging.cessda.eu/');
    break;
    case "www.adp.fdv.uni-lj.si":
      sitemapResFiltered= sitemapRes.sites.filter((temp) => {
        return temp.includes("opisi");
      });
    break;
    case "snd.gu.se":
      sitemapResFiltered = sitemapRes.sites;
    break;
  }
  //create directory for storing results per sitemap link
  let dir: string = '../outputs/'+hostname;
  if (!existsSync(dir))
    mkdirSync(dir, { recursive: true });
  //create date of testing
  const runDate = new Date();
  const fullDate: string = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
  //Initiating CSV writer
  const csvFUJI = new Readable({ objectMode: true });
  csvFUJI._read = () => { };

  // Begin API Loop for studies fetched
  for (const site of sitemapResFiltered) {
    logger.info(`Processing study: ${site}`);
    const urlLink: URL = new URL(site);
    let studyInfo: StudyInfo = {
      url: site,
      urlParams: urlLink.searchParams,
      urlPath: urlLink.pathname.substring(1)
    };  
    if (site.includes("datacatalogue.cessda.eu") || site.includes("datacatalogue-staging.cessda.eu")){  //get the publisher + studyNumber from CDC Internal API
      studyInfo.fileName = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + fullDate + ".json";
      const temp: StudyInfo = await getCDCApiInfo(studyInfo, requestHeaders);
      studyInfo.publisher = temp.publisher;
      studyInfo.studyNumber = temp.studyNumber;
    }
    else if(site.includes("snd.gu.se") || site.includes("adp.fdv.uni-lj")){
      studyInfo.fileName = studyInfo.urlPath?.replaceAll('/', '-')+".json";
      studyInfo.publisher = hostname;
    }
    else{ // Dataverse cases
      studyInfo.fileName = studyInfo.urlParams?.get('persistentId') + "-" + fullDate + ".json";
      studyInfo.fileName = studyInfo.fileName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g,"-");
      studyInfo.publisher = hostname;
    }
    //TODO: await 1 promise for both fujiResults and FAIREva results
    const fujiData: JSON | string = await getFUJIResults(studyInfo, base64UsernamePassword, fullDate);
    resultsToElastic(studyInfo.fileName, fujiData);
    resultsToHDD(dir, studyInfo.fileName, fujiData);
    //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function
    csvFUJI.push(fujiData); //Push data to CSV writer
  }
  
  //prepare results to be parsed to csv
  csvFUJI.push(null);
  const fujiOutputLocal = createWriteStream(`../outputs/CSV-FUJI_${hostname}_${fullDate}.csv`, { encoding: 'utf8' });
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