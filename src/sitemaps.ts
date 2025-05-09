import dotenv from 'dotenv';
import { getStudiesAssess } from './helpers/studiesAssessment.js';
import { logger } from "./helpers/logger.js";
import { getStudiesFromSitemap } from "./helpers/fetchSitemapStudies.js";
import { elasticIndexCheck } from './helpers/esFunctions.js';
import { open, readFile, unlink } from 'fs/promises';
dotenv.config({ path: '../.env' })

const failedStudiesLogPath = '../outputs/failed.txt';

//START SCRIPT EXECUTION
logger.info('Start of Script');

//creates ES index if it doesnt exist, skips creating if it does exist
//TODO: conditionally enable Elasticsearch support
await elasticIndexCheck();

//check if failed.txt exists from previous run, and remove it for a clear run
//TODO: only remove on successful reevaluation
try {
  await unlink(failedStudiesLogPath);
} catch (err) {
  // ignore
}

const file = await open('../inputs/sitemapsRUN.txt', 'r');
//for each sitemap line of file input, begin loop
for await (const sitemapLine of file.readLines()) {
  // Parse sitemap
  logger.info("Processing sitemap: %s", sitemapLine);
  const studiesAssessFiltered = await getStudiesFromSitemap(new URL(sitemapLine));

  logger.info("Studies to Assess: %d", studiesAssessFiltered.length);

  // Assess each study
  const outputName = new URL(sitemapLine).hostname;
  await getStudiesAssess(studiesAssessFiltered, outputName);

  logger.info("Finished assessing sitemap: %s", sitemapLine);
}

//check file if any studies failed and re-assess them
try {
  const studiesAssessFailed = (await readFile(failedStudiesLogPath)).toString().replace(/\r\n/g, '\n').split('\n').map(u => new URL(u));
  if (studiesAssessFailed.length > 0) {
    logger.info("Begin assessing failed studies");
    studiesAssessFailed.pop(); //removes last (empty [/n]) element
    await getStudiesAssess(studiesAssessFailed, "failed");
  }
} catch (err) {
  logger.info("Error while checking failed.txt", err);
}

logger.info('End of Script');
