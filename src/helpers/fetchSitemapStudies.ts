import Sitemapper, { type SitemapperResponse } from 'sitemapper';
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
        throw new SitemapError(`Error at sitemapper fetch: ${error}`, { cause: error });
    }
    // TODO: `REMOVE URL's THAT DONT CONTAIN STUDIES FOR ASSESSMENT (LIKE VALID IDENTIFIER IN URL, ETC)
    switch (sitemapLine.hostname) {
        //Dataverse Cases
        case "data.aussda.at":
        case "datacatalogue.sodanet.gr":
        case "ssh.datastations.nl":
        case "www.sodha.be":
            return sitemapRes.sites.filter(site => site.includes("persistentId"));
        case "datacatalogue.cessda.eu":
            return sitemapRes.sites.filter(site => site !== 'https://datacatalogue.cessda.eu/');
        case "datacatalogue-staging.cessda.eu":
            return sitemapRes.sites.filter(site => site !== 'https://datacatalogue-staging.cessda.eu/');
        case "www.adp.fdv.uni-lj.si":
            return sitemapRes.sites.filter(site => site.includes("opisi"));
        case "snd.gu.se":
            return sitemapRes.sites;
        default:
            return [];
    }
}

export class SitemapError extends Error {
}
