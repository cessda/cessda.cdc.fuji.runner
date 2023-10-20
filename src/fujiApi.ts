import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import axios, { type AxiosResponse } from 'axios';
import { dashLogger, logger } from "./logger.js";
import { URL } from 'url';
import { Storage } from '@google-cloud/storage';
import { Client } from '@elastic/elasticsearch'
import { createWriteStream, writeFile, existsSync, mkdirSync } from 'fs';
import { Transform } from "json2csv";
import { parseAsync } from "json2csv";
import { Readable } from 'stream';
import * as dotenv from 'dotenv'
import * as fsPromise from 'fs/promises'; 
dotenv.config({ path: '../.env' })

// Elasticsearch Client - Defaults to localhost if true and unspecified
const elasticsearchUrl = process.env['PASC_ELASTICSEARCH_URL'] || "http://localhost:9200/";
const elasticsearchUsername = process.env['SEARCHKIT_ELASTICSEARCH_USERNAME'];
const elasticsearchPassword = process.env['SEARCHKIT_ELASTICSEARCH_PASSWORD'];
const debugEnabled = process.env['PASC_DEBUG_MODE'] === 'true';

const client = elasticsearchUsername && elasticsearchPassword ? new Client({
  node: elasticsearchUrl,
  auth: {
    username: elasticsearchUsername,
    password: elasticsearchPassword
  }
})
  : new Client({
    node: elasticsearchUrl,
  })

// Create a google client with explicit credentials - jsonFile
/*const storage = new Storage({
    projectId: 'cessda-dev',
    keyFilename: '/path/to/keyfile.json'
});*/
// Create a google client with explicit credentials - ENV
/*const storage = new Storage({
  projectId: process.env.GOOGLE_STORAGE_PROJECT_ID,
  scopes: 'https://www.googleapis.com/auth/cloud-platform',
  credentials: {
    client_email: process.env.GOOGLE_STORAGE_EMAIL,
    private_key: process.env.GOOGLE_STORAGE_PRIVATE_KEY,
  }
});*/

const storage = new Storage(); //localhost test auth
const bucketName = 'cessda-fuji-storage-dev';

async function apiRunner(sitemapLine: URL): Promise<void> {
  const hostname = sitemapLine.hostname;
  //prepare request for gathering all study links
  const cdcLinks = new Sitemapper({
    url: sitemapLine.toString(),
    timeout: 5000, // 5 seconds
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
  if (!existsSync(dir)){
    mkdirSync(dir, { recursive: true });
  }
  const runDate = new Date();
  const fullDate: string = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
  //Initiating CSV writer
  const csvFUJI = new Readable({ objectMode: true });
  csvFUJI._read = () => { };
  // Begin API Loop for studies fetched
  for (const site of sitemapResFiltered) {
    logger.info(`Processing study: ${site}`);
    const urlLink: URL = new URL(site);
    let fileName: string;
    let studyInfo: StudyInfo = {
      urlParams: urlLink.searchParams,
      urlPath: urlLink.pathname.substring(1)
    };  
    if (site.includes("datacatalogue.cessda.eu")){  //get the publisher from CDC Internal API
      fileName = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + fullDate + ".json";
      const temp: StudyInfo = await getCDCPublisher(studyInfo.urlParams);
      studyInfo.publisher = temp.publisher;
      studyInfo.pidStudies = temp.pidStudies;
    }
    else if(site.includes("snd.gu.se") || site.includes("adp.fdv.uni-lj")){
      fileName = studyInfo.urlPath?.replaceAll('/', '-')+".json";
      studyInfo.publisher = hostname;
    }
    else{ // Dataverse cases
      //
      fileName = studyInfo.urlParams?.get('persistentId') + "-" + fullDate + ".json";
      fileName = fileName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g,"-");
      studyInfo.publisher = hostname;
    }
    //TODO: await 1 promise for both fujiResults and FAIREva results
    const fujiData: JSON | undefined = await getFUJIResults(site, studyInfo, fullDate);
    resultsToElastic(fileName, fujiData);
    resultsToHDD(dir, fileName, fujiData);
    //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function
    csvFUJI.push(fujiData); //Push data to CSV writer
  }
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

async function elasticIndexCheck() {
  const { body: exists } = await client.indices.exists({ index: 'fuji-results' })
  if (!exists) {
    await client.indices.create({
      index: 'fuji-results',
      body: {
        mappings: {
          dynamic: 'runtime',
          properties: {
            id: { type: 'keyword' },
            body: { type: 'object' }
          }
        }
      }
    })
    logger.info('ES Index Created');
  }
}

async function getCDCPublisher(urlParams: URLSearchParams | undefined): Promise<StudyInfo>{
  const cdcApiUrl = 'https://datacatalogue.cessda.eu/api/json/cmmstudy_' + urlParams?.get('lang') + '/' + urlParams?.get('q');
  let cdcApiRes: AxiosResponse<any, any>;
  let publisher: string = "NOT-FETCHED-CDC-PUBLISHER";
  let pidStudies: string = "NOT-FETCHED-CDC-PIDSTUDIES";
  let maxRetries: number = 10;
  let retries: number = 0;
  let success: boolean = false;
  while (retries <= maxRetries && !success) {
    try {
      cdcApiRes = await axios.get(cdcApiUrl);
      logger.info(`CDC Internal API statusCode: ${cdcApiRes.status}`);
      publisher = cdcApiRes.data.publisherFilter.publisher;
      pidStudies = cdcApiRes.data.pidStudies.forEach( (temp: {agency: string, pid: string}) => {
        switch(temp.agency){
          case "DOI":
          case "Handle":
          case "URN":
          case "ARK":
            if (temp.pid.includes("http")){
              let tempPID = <URL> <unknown>temp.pid;
              return tempPID.pathname.substring(1);
            }   
            else{ //type of pidStudies is string
              return temp.pid;
            }
          //TODO: also include other pids? i.e. "DANS-KNAW"
          default:
            return "NOT-DOI-Handle-URN-ARK";
        }
    });
      success = true;
    }
    catch (error) {
      logger.error(`Error at CDC Internal API Fetch: ${error}`);
      dashLogger.error(`Error at CDC Internal API Fetch: ${error}, URL:${cdcApiUrl}, time:${new Date().toUTCString()}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
    }
    retries++;
  }
  if(retries >= maxRetries){
    logger.error(`Too many  request retries on internal CDC API.`);
    dashLogger.error(`Too many  request retries on internal CDC API, URL:${cdcApiUrl}, time:${new Date().toUTCString()}`);
    publisher = "NOT-FETCHED-CDC-PUBLISHER";
  }

  const cdcApiVars: StudyInfo = {publisher: publisher, pidStudies: pidStudies};
  return cdcApiVars;
}

async function getFUJIResults(link: string, studyInfo: StudyInfo, fullDate: string): Promise<JSON | undefined> {
  let fujiRes: AxiosResponse<any, any>;
  let fujiResults: any | undefined;
  let maxRetries: number = 10;
  let retries: number = 0;
  let success: boolean = false;
  while (retries <= maxRetries && !success) {
    try {
      fujiRes = await axios.post(process.env['FUJI_API_LOCAL']!, {
        "metadata_service_endpoint": "",
        "metadata_service_type": "",
        "object_identifier": link,
        "test_debug": true,
        "use_datacite": true
      }, {
        auth: {
          username: process.env['FUJI_USERNAME_LOCAL']!,
          password: process.env['FUJI_PASSWORD_LOCAL']!
        }
      });
      logger.info(`FujiAPI statusCode: ${fujiRes.status}`);
      fujiResults = fujiRes.data;
      success = true;
    }
    catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`AxiosError at FujiAPI: ${error.message}, Response Status:${error.response?.status}, URL:${link}`);
        dashLogger.error(`AxiosError at FujiAPI: ${error.message}, Response Status:${error.response?.status}, URL:${link}, time:${new Date().toUTCString()}`);
      }
      else {
        logger.error(`Error at FujiAPI: ${error}, URL:${link}`);
        dashLogger.error(`Error at FujiAPI: ${error}, URL:${link}, time:${new Date().toUTCString()}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); //delay new retry by 5sec
    }
    retries++;
  }
  if(retries >= maxRetries){
    logger.error(`Too many  request retries on FujiAPI.`);
    dashLogger.error(`Too many  request retries on FujiAPI, URL:${link}, time:${new Date().toUTCString()}`);
    return undefined; //skip study assessment
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
  fujiResults['dateID'] = "FujiRun-" + fullDate;
  // TODO: CHECK FOR OTHER SP'S URI PARAMS
  if (link.includes("datacatalogue.cessda.eu")){
    fujiResults['uid'] = studyInfo.urlParams?.get('q') + "-" + studyInfo.urlParams?.get('lang') + "-" + fullDate;
    fujiResults['pid'] = studyInfo.pidStudies;
  }
  else if(link.includes("snd.gu.se") || link.includes("adp.fdv.uni-lj")){
    //fujiResults['uid'] = studyInfo.urlPath?.replaceAll('/', '-') + "-" + fullDate;
    fujiResults['uid'] = studyInfo.urlPath + "-" + fullDate;
    fujiResults['pid'] = studyInfo.urlPath;
  }
  else // Dataverse cases
    //fujiResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + fullDate; 
    fujiResults['uid'] = studyInfo.urlParams?.get('persistentId') + "-" + fullDate; 
    fujiResults['pid'] = studyInfo.urlParams?.get('persistentId');
  
  return fujiResults;
}

async function resultsToElastic(fileName: string, fujiResults: JSON | undefined) {
  try {
    const elasticdoc = {
      index: 'fuji-results',
      id: fileName,
      body: {
        fujiResults
      }
    }
    await client.index(elasticdoc)
    logger.info(`inserted successfully in ES: ${fileName}`);
  }
  catch (error) {
    logger.error(`error in insert to ES: ${error}, filename:${fileName}`);
    dashLogger.error(`error in insert to ES: ${error}, filename:${fileName}, time:${new Date().toUTCString()}`);
  }
}

async function resultsToHDD(dir: string, fileName: string, fujiResults: JSON | undefined) {
  writeFile(`${dir}/${fileName}`, JSON.stringify(fujiResults, null, 4), (err) => {
    if (err) {
      logger.error(`Error writing to file: ${err}, filename:${fileName}`);
      dashLogger.error(`Error writing to file: ${err}, filename:${fileName}, time:${new Date().toUTCString()}`);
    }
    else
      logger.info(`File written successfully: ${fileName}`);
  });
}

async function uploadFromMemory(fileName: string, fujiResults: Buffer) {
  /* DEBUG CODE
  const storageBucket = storage.bucket(bucketName);
  storage.getBuckets().then(x => console.log(x));
  */
  await storage.bucket(bucketName).file(fileName).save(Buffer.from(JSON.stringify(fujiResults)));
  logger.info(
    `${fileName} with contents uploaded to ${bucketName}.`
  );
}

//START EXECUTION
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