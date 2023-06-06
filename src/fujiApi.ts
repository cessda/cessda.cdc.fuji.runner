import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import axios, { type AxiosResponse } from 'axios';
import { dashLogger, logger } from "./logger.js";
import { URL } from 'url';
import { Storage } from '@google-cloud/storage';
import { Client } from '@elastic/elasticsearch'
import { createWriteStream, writeFile } from 'fs';
import { Transform } from "json2csv";
import { parseAsync } from "json2csv";
import { Readable } from 'stream';
import * as dotenv from 'dotenv'
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

async function fujiMetrics() {
  //prepare request for gathering all study links
  const cdcLinks = new Sitemapper({
    url: 'https://datacatalogue.cessda.eu/sitemap_index.xml',
    timeout: 5000, // 5 seconds
  });
  //Start Execution
  await elasticIndexCheck(); //creates ES index if it doesnt exist, skips creating if it does exist
  const runDate = new Date();
  //const fullDate =  runDate.toISOString();
  const fullDate = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
  let sitemapRes: SitemapperResponse | undefined;
  try {
    sitemapRes = await cdcLinks.fetch();
  }
  catch (error) {
    logger.error(`Error at sitemapper fetch: ${error}`);
    dashLogger.error(`Error at sitemapper fetch: ${error} Sitemapper Error: ${sitemapRes?.errors}, time:${new Date().toUTCString()}`);
    return;
  }
  sitemapRes.sites.shift(); //remove 1st element - https://datacatalogue.cessda.eu/
  logger.info(`Links Collected: ${sitemapRes.sites.length}`);
  const input = new Readable({ objectMode: true }); //initiating CSV writer
  input._read = () => { };
  // Begin API Loop for studies fetched 
  for (const site of sitemapRes.sites) {
    const data = await apiLoop(site, fullDate);
    input.push(data);
  }
  input.push(null);
  const outputLocal = createWriteStream(`../outputs/CSV_DATA_${fullDate}.csv`, { encoding: 'utf8' });
  const fields = [
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
    'publisher'
  ];
  const opts = { fields };
  const transformOpts = { objectMode: true };
  const json2csv = new Transform(opts, transformOpts);
  const processor = input.pipe(json2csv).pipe(outputLocal);
  try {
    await parseAsync(processor, opts);
  } catch (err) {
    logger.error(`CSV writer Error: ${err}`)
  }
  logger.info('Finished API loop function');
  logger.info('Script Ended');
};

async function apiLoop(link: string, fullDate: string): Promise<JSON | undefined> {
  //Begin Internal CDC API call to access study details (publisher)
  const urlLink = new URL(link);
  const urlParams = urlLink.searchParams;
  const fileName = urlParams.get('q') + "-" + urlParams.get('lang') + "-" + fullDate + ".json";
  logger.info(`\n`);
  logger.info(`Name: ${fileName}`);
  const cdcApiUrl = 'https://datacatalogue.cessda.eu/api/json/cmmstudy_' + urlParams.get('lang') + '/' + urlParams.get('q');
  let cdcApiRes: AxiosResponse<any, any>;
  let publisher: string | undefined;
  let maxRetries: number = 10;
  let retries: number = 0;
  let success: boolean = false;
  while (retries <= maxRetries && !success) {
    try {
      cdcApiRes = await axios.get(cdcApiUrl);
      logger.info(`CDC Internal API statusCode: ${cdcApiRes.status}`);
      publisher = cdcApiRes.data.publisherFilter.publisher;
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
    publisher = "NOT-FETCHED-PUBLISHER";
  }
  //Begin F-UJI API call to access study details (publisher)
  let fujiRes: AxiosResponse<any, any>;
  let fujiResults: any | undefined;
  retries = 0;
  success = false;
  while (retries <= maxRetries && !success) {
    try {
      fujiRes = await axios.post('http://34.107.135.203/fuji/api/v1/evaluate', {
        "metadata_service_endpoint": "",
        "metadata_service_type": "",
        "object_identifier": link,
        "test_debug": true,
        "use_datacite": true
      }, {
        auth: {
          username: process.env['FUJI_USERNAME']!,
          password: process.env['FUJI_PASSWORD']!
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
  fujiResults['publisher'] = publisher;
  fujiResults['uid'] = urlParams.get('q') + "-" + urlParams.get('lang') + "-" + fullDate;
  fujiResults['dateID'] = "FujiRun-" + fullDate;
  //save data to ES and/or localFiles/CloudBucket
  await resultsToElastic(fileName, fujiResults);
  resultsToHDD(fileName, fujiResults); //Write-to-HDD-localhost function
  //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function

  return fujiResults;
} //END apiLoop function

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

async function resultsToElastic(fileName: string, fujiResults: JSON) {
  try {
    const elasticdoc = {
      index: 'fuji-results',
      id: fileName,
      body: {
        fujiResults
      }
    }
    await client.index(elasticdoc)
    logger.info(`inserted in ES: ${fileName}`);
  }
  catch (error) {
    logger.error(`error in insert to ES: ${error}, filename:${fileName}`);
    dashLogger.error(`error in insert to ES: ${error}, filename:${fileName}, time:${new Date().toUTCString()}`);
  }
}

async function uploadFromMemory(fileName: string, fujiResults: Buffer) {
  /* DEBUG CODE
  const storageBucket = storage.bucket(bucketName);
  storage.getBuckets().then(x => console.log(x));
  throw new Error("controlled termination");
  */
  await storage.bucket(bucketName).file(fileName).save(Buffer.from(JSON.stringify(fujiResults)));
  logger.info(
    `${fileName} with contents uploaded to ${bucketName}.`
  );
}

function resultsToHDD(fileName: string, fujiResults: JSON) {
  writeFile(`../outputs/${fileName}`, JSON.stringify(fujiResults, null, 4), (err) => {
    if (err) {
      logger.error(`Error writing to file: ${err}, filename:${fileName}`);
      dashLogger.error(`Error writing to file: ${err}, filename:${fileName}, time:${new Date().toUTCString()}`);
    }
    else
      logger.info("File written successfully");
  });
}

await fujiMetrics();
