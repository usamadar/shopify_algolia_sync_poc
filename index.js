require('dotenv').config();
const axios = require('axios');
const algoliasearch = require('algoliasearch');

// Initialize Algolia client
const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_API_KEY);

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
  console.log(`Fetching product variants... ${cursor ? `Cursor: ${cursor}` : ''}`);
  const query = getProductsQuery(country, locale, batchSize, cursor);
  const response = await axios.post(shopifyBaseURL, { query }, {
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json'
    }
  });
  console.log('Fetched product variants');
  return response.data.data.products;
};

const syncToAlgolia = async (indexName, records) => {
  console.log(`Syncing ${records.length} records to Algolia index ${indexName}`);
  const index = client.initIndex(indexName);
  await index.saveObjects(records);
  console.log(`Synced ${records.length} records to Algolia`);
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

  let hasNextPage = true;
  let cursor = null;
  let totalUpdated = 0;

  while (hasNextPage) {
    const data = await fetchProductVariants(country, locale, batchSize, cursor);

    const records = data.edges.map(({ node }) => {
      const translatedTitle = node.translations.find(translation => translation.key === 'title')?.value || node.title;
      return node.variants.edges.map(({ node: variant }) => ({
        objectID: variant.id,
        title: translatedTitle,
        price: variant.contextualPricing?.price?.amount || 0,
        compareAtPrice: variant.contextualPricing?.compareAtPrice?.amount || 0
      }));
    }).flat();

    await syncToAlgolia(indexName, records);

    totalUpdated += records.length;
    console.log(`Total updated so far: ${totalUpdated}`);

    hasNextPage = data.pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor = data.edges[data.edges.length - 1].cursor;
    }
  }

  console.log('Sync complete');
};

main();
