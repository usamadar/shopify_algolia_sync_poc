# Create a ".env" in the current folder with following properties
```
SHOPIFY_STORE=your-shopify-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-shopify-access-token
ALGOLIA_APP_ID=your-algolia-app-id
ALGOLIA_ADMIN_API_KEY=your-algolia-admin-api-key
```

# Usage
To run the script, use the following command:

```
node index.js <country_code> <locale_code> <algolia_index_name> <batch_size>

<country_code>: The country code for Shopify context (e.g., PT).
<locale_code>: The locale code for translations (e.g., pt-pt).
<algolia_index_name>: The name of the Algolia index to sync.
<batch_size>: The number of products to fetch per batch. This can't be greater than 250
```
# Example
```
node index.js PT pt-pt my_algolia_index 250
```
This command fetches products from the Shopify store for the given country, translates titles to ```pt-pt```, and syncs them to the ```my_algolia_index``` in Algolia.

# To run the parallel version
```node index_parallel.js PT pt-pt my_algolia_index 250```
This will run the parallel loading with starting 5 batches at any given time each with a fetch size of 250. 
The parallel batch of 5 is the one i found the best results. I start getting errors with parallel batch over 10. 
