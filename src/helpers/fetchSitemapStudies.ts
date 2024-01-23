import Sitemapper, { type SitemapperResponse } from 'sitemapper';
import { dashLogger, logger } from "./logger.js";
import { requestHeaders } from "./cdcStagingConn.js";

export async function getStudiesFromSitemap(sitemapLine: URL): Promise<string[]> {
    //prepare request for gathering all URL's from the sitemap
    const cdcLinks = new Sitemapper({
        url: sitemapLine.toString(),
        timeout: 5000, // 5 seconds,
        requestHeaders
    });
    let sitemapRes: SitemapperResponse;
    try {
        sitemapRes = await cdcLinks.fetch();
    }
    catch (error) {
        logger.error(`Error at sitemapper fetch: ${error}`);
        dashLogger.error(`Error at sitemapper fetch: ${error}, time:${new Date().toUTCString()}`);
        process.exit(1);
    }
    logger.info(`Links Collected: ${sitemapRes.sites.length}`);
    // TODO: `REMOVE URL's THAT DONT CONTAIN STUDIES FOR ASSESSMENT (LIKE VALID IDENTIFIER IN URL, ETC)
    let sitemapResFiltered: string[] = [];
    switch (sitemapLine.hostname) {
        //Dataverse Cases
        case "data.aussda.at":
        case "datacatalogue.sodanet.gr":
        case "ssh.datastations.nl":
        case "www.sodha.be":
            sitemapResFiltered = sitemapRes.sites.filter(site => site.includes("persistentId"));
            break;
        case "datacatalogue.cessda.eu":
            sitemapResFiltered = sitemapRes.sites.filter(site => site !== 'https://datacatalogue.cessda.eu/');
            break;
        case "datacatalogue-staging.cessda.eu":
            sitemapResFiltered = sitemapRes.sites.filter(site => site !== 'https://datacatalogue-staging.cessda.eu/');
            break;
        case "www.adp.fdv.uni-lj.si":
            sitemapResFiltered = sitemapRes.sites.filter(site => site.includes("opisi"));
            break;
        case "snd.gu.se":
            sitemapResFiltered = sitemapRes.sites;
            break;
    }
    logger.info(`Studies to Assess: ${sitemapResFiltered.length}`);
    return sitemapResFiltered;
}
