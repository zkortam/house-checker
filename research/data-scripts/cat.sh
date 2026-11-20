#!/bin/bash
for q in "$@"; do
 echo "=== $q"; curl -s -G "https://data.sf.gov/api/catalog/v1" --data-urlencode "domains=data.sf.gov" --data-urlencode "search_context=data.sf.gov" --data-urlencode "q=$q" --data-urlencode "limit=15" --data-urlencode "only=dataset,map" | jq -r '.results[]? | "\(.resource.id)\t\(.resource.type)\t\(.resource.data_updated_at // .resource.updatedAt|.[0:10])\t\(.resource.name)"'
done
