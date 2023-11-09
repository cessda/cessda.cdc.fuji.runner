import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import { dashLogger, logger } from "./logger.js";

//To use if testing against CDC staging
const cdcusername = process.env['CDC_USERNAME'];
const cdcpassword = process.env['CDC_PASSWORD'];

const usernamePasswordBuffer = Buffer.from(
    `${cdcusername}:${cdcpassword}`,
    "utf-8"
);
const base64UsernamePassword = usernamePasswordBuffer.toString("base64");
const requestHeaders = {
    Authorization: `Basic ${base64UsernamePassword}`,
};

export async function getStudiesFromSitemap(sitemapLine: URL): Promise<string[]> {
    //prepare request for gathering all url's existing on sitemap
    const cdcLinks = new Sitemapper({
        url: sitemapLine.toString(),
        timeout: 5000, // 5 seconds,
        requestHeaders
    });
    let sitemapRes: SitemapperResponse | undefined;
    try {
        sitemapRes = await cdcLinks.fetch();
    }
    catch (error) {
        logger.error(`Error at sitemapper fetch: ${error}`);
        dashLogger.error(`Error at sitemapper fetch: ${error} Sitemapper Error: ${sitemapRes?.errors}, time:${new Date().toUTCString()}`);
        return process.exit(1);
    }
    logger.info(`Links Collected: ${sitemapRes.sites.length}`);
    // TODO: `REMOVE URL's THAT DONT CONTAIN STUDIES FOR ASSESSMENT (LIKE VALID IDENTIFIER IN URL, ETC)
    let sitemapResFiltered: string[] = [];
    switch (sitemapLine.hostname) {
        case "data.aussda.at":
            sitemapResFiltered = sitemapRes.sites.filter((temp) => {
                return temp.includes("persistentId");
            });
            break;
        case "datacatalogue.sodanet.gr":
            sitemapResFiltered = sitemapRes.sites.filter((temp) => {
                return temp.includes("persistentId");
            });
            break;
        case "ssh.datastations.nl":
            sitemapResFiltered = sitemapRes.sites.filter((temp) => {
                return temp.includes("persistentId");
            });
            break;
        case "www.sodha.be":
            sitemapResFiltered = sitemapRes.sites.filter((temp) => {
                return temp.includes("persistentId");
            });
            break;
        case "datacatalogue.cessda.eu":
            sitemapResFiltered = sitemapRes.sites.filter(temp => temp !== 'https://datacatalogue.cessda.eu/');
            break;
        case "datacatalogue-staging.cessda.eu":
            sitemapResFiltered = sitemapRes.sites.filter(temp => temp !== 'https://datacatalogue-staging.cessda.eu/');
            break;
        case "www.adp.fdv.uni-lj.si":
            sitemapResFiltered = sitemapRes.sites.filter((temp) => {
                return temp.includes("opisi");
            });
            break;
        case "snd.gu.se":
            sitemapResFiltered = sitemapRes.sites;
            break;
    }
    logger.info(`Studies to Assess: ${sitemapResFiltered.length}`);
    return sitemapResFiltered;
}