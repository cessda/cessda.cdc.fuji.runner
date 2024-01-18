import { Storage } from '@google-cloud/storage';
import { readFile, writeFile } from 'fs';
import { dashLogger, logger } from "./logger.js";
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

export async function uploadFromMemory(fileName: string, assessResults: Buffer) {
  /* DEBUG CODE
  const storageBucket = storage.bucket(bucketName);
  storage.getBuckets().then(x => console.log(x));
  */
  await storage.bucket(bucketName).file(fileName).save(Buffer.from(JSON.stringify(assessResults)));
  logger.info(
    `${fileName} with contents uploaded to ${bucketName}.`
  );
}

export async function resultsToHDD(dir: string, fileName: string, assessResults: string | JSON) {
  writeFile(`${dir}/${fileName}`, JSON.stringify(assessResults, null, 4), (err) => {
    if (err) {
      logger.error(`Error writing to file: ${err}, filename:${fileName}`);
      dashLogger.error(`Error writing to file: ${err}, filename:${fileName}, time:${new Date().toUTCString()}`);
    }
    else {
      logger.info(`File written successfully: ${fileName}`);
    }
  });
}

export function isFileEmpty(fileName: string, ignoreWhitespace = true) {
  return new Promise((resolve, reject) => {
    readFile(fileName, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((!ignoreWhitespace && data.length == 0) || (ignoreWhitespace && !!String(data).match(/^\s*$/)))
    });
  })
}