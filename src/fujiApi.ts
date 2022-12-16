import Sitemapper from 'sitemapper';
import axios from 'axios';
import winston from 'winston';
import { URL } from 'url';
import { Storage } from '@google-cloud/storage';
import { Client, RequestParams } from '@elastic/elasticsearch'
import fs, { createWriteStream } from 'fs';
import fetch from 'node-fetch'
import { Transform } from "json2csv";
import { Readable } from 'stream';
import { parseAsync } from "json2csv";

const logLevel = process.env.SEARCHKIT_LOG_LEVEL || 'info';
function loggerFormat() {
  if (process.env.SEARCHKIT_USE_JSON_LOGGING === 'true') {
    return winston.format.json();
  } else {
    return winston.format.printf(
      ({ level, message, timestamp }) => `[${timestamp}][${level}] ${message}`
    );
  }
}

// Logger
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),
    loggerFormat()
  ),
  transports: [
    new winston.transports.Console()
  ],
  exceptionHandlers: [
    new winston.transports.Console()
  ],
});

// Elasticsearch Client - Defaults to localhost if true and unspecified
const elasticsearchUrl = process.env.PASC_ELASTICSEARCH_URL || "http://localhost:9200/";
const elasticsearchUsername = process.env.SEARCHKIT_ELASTICSEARCH_USERNAME;
const elasticsearchPassword = process.env.SEARCHKIT_ELASTICSEARCH_PASSWORD;
const debugEnabled = process.env.PASC_DEBUG_MODE === 'true';

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

function fujiMetrics() {

  (async () => {
    const cdcLinks = new Sitemapper({
      url: 'https://datacatalogue.cessda.eu/sitemap_index.xml',
      timeout: 15000, // 15 seconds
      debug: true,
      retries: 1,
    });
    try {
      await elasticIndexCheck(); //creates index if it doesnt exist, skips creating if it does exist
      const runDate = new Date();
      //const fullDate =  runDate.toISOString();
      const fullDate = [runDate.getFullYear(), runDate.getMonth()+1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');
      const { sites } = await cdcLinks.fetch();
      sites.shift(); //remove 1st element - https://datacatalogue.cessda.eu/
      logger.info(`Links Collected: ${sites.length}`);
      const input = new Readable({ objectMode: true }); //initiating CSV writer
      input._read = () => {};
      //const arrayTests = sites.slice(0, 5); //DEBUG CODE FOR TESTS - REDUCE ARRAY TO 5 STUDIES!!!!!!!!!!!!!!!!!!
      for (const site of sites) {
        await apiLoop(site, fullDate).then(data => 
          input.push(data)
        );
      }
      input.push(null);
      const outputLocal = createWriteStream(`../runResults/CSV_DATA_${fullDate}.csv`, { encoding: 'utf8' });
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
      parseAsync(processor, opts).then(csv => logger.info('CSV file created succesfully')).catch(err => logger.error(`Error at CSV writer: ${err}`));
    } catch (error) {
      console.log(`Error at crawling indexer: ${error}`);
      logger.error(`Error at crawling indexer: ${error}`);
    } finally {
      logger.info('Finished apiLoop function');
    }
    logger.info('Script Ended');
  })();
}

async function apiLoop(link: string, fullDate: string): Promise<JSON> {
  const urlLink = new URL(link);
  const urlParams = urlLink.searchParams;
  const fileName = urlParams.get('q') + "-" + urlParams.get('lang') + "-" + fullDate + ".json";
  logger.info(`\n`);
  logger.info(`Name: ${fileName}`);
  const cdcApiUrl = 'https://datacatalogue.cessda.eu/api/json/cmmstudy_' + urlParams.get('lang') + '/' + urlParams.get('q');
  const response = await fetch(cdcApiUrl);
  const data = await response.json() as any;
  const publisher = data.publisherFilter.publisher;
  return new Promise(function (resolve) {
    axios
      .post('http://34.107.135.203/fuji/api/v1/evaluate', {
        "metadata_service_endpoint": "",
        "metadata_service_type": "",
        "object_identifier": link,
        "test_debug": true,
        "use_datacite": true
      }, {
        auth: {
          username: "wallice",
          password: "grommit"
        }
      })
      .then(async (res: { status: any; data: any; }) => {
        logger.info(`statusCode: ${res.status}`);
        const fujiResults = res.data;
        delete fujiResults['results'];
        delete fujiResults.summary.maturity;
        delete fujiResults.summary.score_earned;
        delete fujiResults.summary.score_total;
        delete fujiResults.summary.status_passed
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

        resultsToElastic(fileName, fujiResults).then(()=>{
        //resultsToHDD(fileName, fujiResults); //Write-to-HDD-localhost function
        //uploadFromMemory(fileName, fujiResults).catch(console.error); //Write-to-Cloud-Bucket function
        })

        resolve(fujiResults);

      })
      .catch((error: any) => {
        console.error(`Error at FuJI API: ${error}`)
        logger.error(`Error at FuJI API: ${error}`);
      })
  });
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
    const elasticdoc: RequestParams.Index = {
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
    logger.error(`error in insert to ES: ${error}`);
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
  fs.writeFile(`../runResults/${fileName}`, JSON.stringify(fujiResults, null, 4).toString(), (err) => {
    if (err)
      logger.error(`Error writing to file: ${err}`);
    else {
      logger.info("File written successfully");
    }
  });
}

fujiMetrics();