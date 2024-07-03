require('dotenv').config();
const axios = require('axios');
const algoliasearch = require('algoliasearch');
const { performance } = require('perf_hooks');

// Initialize Algolia client
const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_API_KEY);
let algoliaIndex;

const shopifyBaseURL = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-07/graphql.json`;

const getProductsQuery = (country, locale, batchSize, cursor = null) => {
  return `{
    products(first: ${batchSize}, after: ${cursor ? `"${cursor}"` : null}, query: "status:active") {
      edges {
        cursor
        node {
          id
          title
          status
          publishedInContext(context: { country: ${country} })
          translations(locale: "${locale}") {
            key
            value
          }
          variants(first: ${batchSize}) {
            edges {
              node {
                id
                title
                price
                contextualPricing(context: {country: ${country}}) {
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }`;
};

const fetchProductVariants = async (country, locale, batchSize, cursor = null) => {
  const query = getProductsQuery(country, locale, batchSize, cursor);
  try {
    const response = await axios.post(shopifyBaseURL, { query }, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    return response.data.data.products;
  } catch (error) {
    console.error('Error fetching product variants:', error.response ? error.response.data : error.message);
    throw error;
  }
};

const syncToAlgolia = async (records) => {
  try {
    await algoliaIndex.saveObjects(records);
  } catch (error) {
    console.error('Error syncing to Algolia:', error);
    throw error;
  }
};

const processBatch = async (country, locale, batchSize, cursor) => {
  try {
    const data = await fetchProductVariants(country, locale, batchSize, cursor);
    const records = data.edges.flatMap(({ node }) => {
      const translatedTitle = node.translations.find(translation => translation.key === 'title')?.value || node.title;
      return node.variants.edges.map(({ node: variant }) => ({
        objectID: variant.id,
        title: translatedTitle,
        price: variant.contextualPricing?.price?.amount || 0,
        compareAtPrice: variant.contextualPricing?.compareAtPrice?.amount || 0
      }));
    });

    if (records.length > 0) {
      await syncToAlgolia(records);
    }

    const newCursor = data.edges.length > 0 ? data.edges[data.edges.length - 1].cursor : null;


    return {
      hasNextPage: data.pageInfo.hasNextPage,
      cursor: newCursor,
      recordCount: records.length
    };
  } catch (error) {
    console.error(`Error processing batch with cursor ${cursor}:`, error);
    throw error;
  }
};

const processAndSyncData = async (country, locale, batchSize) => {
  let hasNextPage = true;
  let cursor = null;
  let totalUpdated = 0;
  const parallelBatches = 5; // Number of batches to process in parallel

  while (hasNextPage) {
    console.log(`Starting ${parallelBatches} New Batches With ${batchSize} Products`)
    const batchPromises = [];
    for (let i = 0; i < parallelBatches && hasNextPage; i++) {
      batchPromises.push(processBatch(country, locale, batchSize, cursor));
    }

    try {
      const batchResults = await Promise.all(batchPromises);

      // Determine if any batch hasNextPage and update cursor accordingly
      hasNextPage = false;
      batchResults.forEach(result => {
        if (result.hasNextPage) {
          hasNextPage = true;
          cursor = result.cursor;
        }
      });
    } catch (error) {
      console.error('Error in one of the batch processes:', error);
      break; // Stop further processing if any batch fails
    }
  }

  console.log('Sync complete');
};

const main = async () => {
  const [,, country, locale, indexName, batchSizeArg] = process.argv;

  if (!country || !locale || !indexName || !batchSizeArg) {
    console.log('Usage: node index.js <country_code> <locale_code> <algolia_index_name> <batch_size>');
    process.exit(1);
  }

  const batchSize = parseInt(batchSizeArg, 10);
  if (isNaN(batchSize) || batchSize <= 0) {
    console.log('Batch size must be a positive integer');
    process.exit(1);
  }
  // Limiting batch size to 250 as this is maximum allowed in non bulk query
  if (batchSize > 250) {
    console.log('Batch size cannot be greater than 250');
    process.exit(1);
  }

  algoliaIndex = client.initIndex(indexName);
  const startTime = performance.now();

  try {
    await processAndSyncData(country, locale, Math.min(batchSize, 250)); // Limiting batch size to 250 as this is maximum allowed in non bulk query
  } catch (error) {
    console.error('Error during sync process:', error);
  } finally {
    const endTime = performance.now();
    const elapsedTime = endTime - startTime;
    console.log(`Execution time: ${(elapsedTime / 1000).toFixed(2)} seconds`);
  }
};

main();
