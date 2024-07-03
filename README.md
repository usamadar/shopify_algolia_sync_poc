## Usage

To run the script, use the following command:

```bash
node index.js <country_code> <locale_code> <algolia_index_name> <batch_size>
<country_code>: The country code for Shopify context (e.g., PT).
<locale_code>: The locale code for translations (e.g., pt-pt).
<algolia_index_name>: The name of the Algolia index to sync.
<batch_size>: The number of products to fetch per batch.
Example
bash
Copy code
node index.js PT pt-pt my_algolia_index 10
This command fetches products from the Shopify store for the given country, translates titles to pt-pt, and syncs them to the my_algolia_index in Algolia.
