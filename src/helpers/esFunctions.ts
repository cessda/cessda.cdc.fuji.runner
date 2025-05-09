import { Client } from '@elastic/elasticsearch';
import { logger } from "./logger.js";

// Elasticsearch Client - Defaults to localhost if true and unspecified
const elasticsearchUrl = process.env['PASC_ELASTICSEARCH_URL'] || "http://localhost:9200/";
const elasticsearchUsername = process.env['SEARCHKIT_ELASTICSEARCH_USERNAME'];
const elasticsearchPassword = process.env['SEARCHKIT_ELASTICSEARCH_PASSWORD'];

const client = elasticsearchUsername && elasticsearchPassword ? new Client({
  node: elasticsearchUrl,
  auth: {
    username: elasticsearchUsername,
    password: elasticsearchPassword
  }
})
: new Client({
    node: elasticsearchUrl,
  });


export async function elasticIndexCheck() {
  const exists = await client.indices.exists({ index: 'fair-results' })
  if (!exists) {
    await client.indices.create({
      index: 'fair-results',
      body: {
        mappings: {
          dynamic: 'runtime',
          properties: {
            id: { type: 'keyword' },
            body: { type: 'object' }
          }
        }
      }
    })
    logger.info('ES Index Created');
  }
}

export async function resultsToElastic(fileName: string, assessResults: string | JSON) {
  try {
    await client.index({
      index: 'fair-results',
      id: fileName,
      document: {
        assessResults
      }
    });
    logger.debug("inserted successfully in ES: %s", fileName);
  }
  catch (error) {
    logger.error("error in insert to ES: %s, filename: %s", error, fileName);
  }
}
