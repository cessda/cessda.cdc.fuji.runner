import * as dotenv from 'dotenv'
import { readFile, unlink } from 'fs/promises';
import { getStudiesAssess } from './helpers/studiesAssessment.js';
import { logger } from "./helpers/logger.js";
import { elasticIndexCheck } from './helpers/esFunctions.js';
dotenv.config({ path: '../.env' });

//START SCRIPT EXECUTION
logger.info('Start of Script');

//creates ES index if it doesnt exist, skips creating if it does exist
await elasticIndexCheck();

//check if failed.txt exists from previous run, and remove it for a clear run
try {
  await unlink('../outputs/failed.txt');
} catch (err) {
  // ignore
}

const studiesRUN = await readFile('../inputs/studiesRUN.txt');
const studiesAssess = (studiesRUN).toString().replace(/\r\n/g, '\n').split('\n').map(u => new URL(u));
const outputName: string = "StudiesAssessment";
await getStudiesAssess(studiesAssess, outputName);
logger.info(`Finished assessing studies`);

//check file if any studies failed and re-assess them
try {
  const studiesAssessFailed = (await readFile('../outputs/failed.txt')).toString().replace(/\r\n/g, '\n').split('\n').map(u => new URL(u));
  if (studiesAssessFailed.length > 0) {
    logger.info("Begin assessing failed studies");
    studiesAssessFailed.pop(); //removes last (empty [/n]) element
    await getStudiesAssess(studiesAssessFailed, "failed");
  }
} catch (err) {
  logger.info("Error while checking failed.txt, %s", err);
}

logger.info('End of Script');
