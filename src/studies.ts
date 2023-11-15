import * as dotenv from 'dotenv'
import * as fsPromise from 'fs/promises';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { getStudiesAssess } from './helpers/studiesAssessment.js';
import { dashLogger, logger } from "./helpers/logger.js";
import { elasticIndexCheck } from './helpers/esFunctions.js';
import { isFileEmpty } from './helpers/writeToFiles.js';
dotenv.config({ path: '../.env' })

//START SCRIPT EXECUTION
logger.info('Start of Script');
dashLogger.info(`Start of Script, time:${new Date().toUTCString()}`);
//creates ES index if it doesnt exist, skips creating if it does exist
await elasticIndexCheck();
//check if failed.txt exists from previous run, and remove it for a clear run
if (existsSync('../outputs/failed.txt'))
  unlinkSync('../outputs/failed.txt');
//const file = await fsPromise.open('../inputs/studiesRUN.txt', 'r');
const studiesAssess: string[] = readFileSync('../inputs/studiesRUN.txt').toString().replace(/\r\n/g, '\n').split('\n');
const outputName: string = "StudiesAssessment";
await getStudiesAssess(studiesAssess, outputName);
logger.info(`Finished assessing studies`);
dashLogger.info(`Finished assessing studies, time:${new Date().toUTCString()}`);
//check file if any studies failed and re-assess them
isFileEmpty('../outputs/failed.txt')
  .then(async (isEmpty) => {
    if (isEmpty == false) {
      logger.info(`Begin assessing failed studies`);
      dashLogger.info(`Begin assessing failed studies, time:${new Date().toUTCString()}`);
      const studiesAssessFailed: string[] = readFileSync('../outputs/failed.txt').toString().replace(/\r\n/g, '\n').split('\n');
      await getStudiesAssess(studiesAssessFailed, "failed");
    }
  })
  .catch((err) => {
    logger.info(`Error while checking failed.txt, ${err}`);
    dashLogger.info(`Error while checking failed.txt, ${err}, time:${new Date().toUTCString()}`);
  });
logger.info('End of Script');
dashLogger.info(`End of Script, time:${new Date().toUTCString()}`);