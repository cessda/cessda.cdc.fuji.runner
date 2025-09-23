import Sitemapper from 'sitemapper';
import { requestHeaders } from "./cdcStagingConn.js";

export async function getStudiesFromSitemap(sitemapLine: URL): Promise<URL[]> {

    //prepare request for gathering all URL's from the sitemap
    const cdcLinks = new Sitemapper({
        url: sitemapLine.toString(),
        timeout: 5000, // 5 seconds,
        requestHeaders
    });

    try {
        // Parse the sitemap
        const sitemapRes = await cdcLinks.fetch();

        // TODO: `REMOVE URL's THAT DONT CONTAIN STUDIES FOR ASSESSMENT (LIKE VALID IDENTIFIER IN URL, ETC)
        const sites = sitemapRes.sites.map(url => new URL(url));
        switch (sitemapLine.hostname) {
            //Dataverse Cases
            case "data.aussda.at":
            case "datacatalogue.sodanet.gr":
            case "ssh.datastations.nl":
            case "www.sodha.be":
                return sites.filter(site => site.href.includes("persistentId"));
            case "datacatalogue.cessda.eu":
            case "datacatalogue-staging.cessda.eu":
                // Only return studies
                return sites.filter(site => site.pathname === '/detail');
            case "www.adp.fdv.uni-lj.si":
                return sites.filter(site => site.pathname.includes("opisi"));
            case "snd.gu.se":
                return sites;
            default:
                return [];
    }
    }
    catch (error) {
        throw new SitemapError(`Error at sitemapper fetch: ${error}`, { cause: error });
    }

}

export class SitemapError extends Error {
}
