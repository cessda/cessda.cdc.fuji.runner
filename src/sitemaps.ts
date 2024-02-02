import dotenv from 'dotenv';
import { URL } from 'url';
import { getStudiesAssess } from './helpers/studiesAssessment.js';
import { logger } from "./helpers/logger.js";
import { getStudiesFromSitemap } from "./helpers/fetchSitemapStudies.js";
import { elasticIndexCheck } from './helpers/esFunctions.js';
import { open, readFile, unlink } from 'fs/promises';
dotenv.config({ path: '../.env' })

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
const file = await open('../inputs/sitemapsRUN.txt', 'r');
//for each sitemap line of file input, begin loop
for await (const sitemapLine of file.readLines()) {
  logger.info("Processing sitemap: %s", sitemapLine);
  const studiesAssessFiltered: string[] = await getStudiesFromSitemap(new URL(sitemapLine));
  logger.info("Studies to Assess: %d", studiesAssessFiltered.length);
  const outputName: string = new URL(sitemapLine).hostname;
  await getStudiesAssess(studiesAssessFiltered, outputName);
  logger.info("Finished assessing sitemap: %s", sitemapLine);
}

//check file if any studies failed and re-assess them
try {
  const studiesAssessFailed: string[] = (await readFile('../outputs/failed.txt')).toString().replace(/\r\n/g, '\n').split('\n');
  if (studiesAssessFailed.length > 0) {
    logger.info("Begin assessing failed studies");
    studiesAssessFailed.pop(); //removes last (empty [/n]) element
    await getStudiesAssess(studiesAssessFailed, "failed");
  }
} catch (err) {
  logger.info("Error while checking failed.txt", err);
}

logger.info('End of Script');
