import dotenv from 'dotenv';
import { URL } from 'url';
import { getStudiesAssess } from './helpers/studiesAssessment.js';
import { dashLogger, logger } from "./helpers/logger.js";
import { getStudiesFromSitemap } from "./helpers/fetchSitemapStudies.js";
import { elasticIndexCheck } from './helpers/esFunctions.js';
import { open, readFile, unlink } from 'fs/promises';
dotenv.config({ path: '../.env' })

//START SCRIPT EXECUTION
logger.info('Start of Script');
dashLogger.info(`Start of Script, time:${new Date().toUTCString()}`);
//creates ES index if it doesnt exist, skips creating if it does exist
await elasticIndexCheck();
//check if failed.txt exists from previous run, and remove it for a clear run
try {
  await unlink('../outputs/failed.txt');
} catch (err) {
  // ignore
}
const file = await open('../inputs/sitemapsRUN.txt', 'r');
//for each sitemap line of file input, begin loop
for await (const sitemapLine of file.readLines()) {
  logger.info(`Processing sitemap: ${sitemapLine}`);
  dashLogger.info(`Processing sitemap: ${sitemapLine}, time:${new Date().toUTCString()}`);
  const studiesAssessFiltered: string[] = await getStudiesFromSitemap(new URL(sitemapLine));
  const outputName: string = new URL(sitemapLine).hostname;
  await getStudiesAssess(studiesAssessFiltered, outputName);
  logger.info(`Finished assessing sitemap: ${sitemapLine}`);
  dashLogger.info(`Finished assessing sitemap: ${sitemapLine}, time:${new Date().toUTCString()}`);
}

//check file if any studies failed and re-assess them
try {
  const studiesAssessFailed: string[] = (await readFile('../outputs/failed.txt')).toString().replace(/\r\n/g, '\n').split('\n');
  if (studiesAssessFailed.length > 0) {
    logger.info(`Begin assessing failed studies`);
    dashLogger.info(`Begin assessing failed studies, time:${new Date().toUTCString()}`);
    studiesAssessFailed.pop(); //removes last (empty [/n]) element
    await getStudiesAssess(studiesAssessFailed, "failed");
  }
} catch (err) {
  logger.info(`Error while checking failed.txt, ${err}`);
  dashLogger.info(`Error while checking failed.txt, ${err}, time:${new Date().toUTCString()}`);
}

logger.info('End of Script');
dashLogger.info(`End of Script, time:${new Date().toUTCString()}`);
