import { Storage } from '@google-cloud/storage';
import { writeFile } from 'fs';
import { logger } from "./logger.js";
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

export function resultsToHDD(dir: string, fileName: string, assessResults: string | JSON) {
  writeFile(`${dir}/${fileName}`, JSON.stringify(assessResults, null, 4), (err) => {
    if (err) {
      logger.error("Error writing to file %s: %s", fileName, err);
    }
    else {
        logger.debug("File written successfully: %s", fileName);
    }
  });
}
