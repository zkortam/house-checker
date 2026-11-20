#!/bin/bash
# usage: meta.sh <id> ; saves metadata json to downloads/meta_<id>.json and prints summary
B=/tmp/claude-1000/-home-surf-housechecker/6d59dc58-1dca-4a2f-a249-42112b148b71/scratchpad/data-research
id=$1
f=$B/downloads/meta_$id.json
curl -s "https://data.sf.gov/api/views/$id.json" -o $f
jq -r '"NAME: \(.name)\nrowsUpdatedAt: \(.rowsUpdatedAt|tostring) (\(.rowsUpdatedAt|todate? // "")) \nviewLastModified: \(.viewLastModified|todate? // "")\ncategory: \(.category)\nfreq: \(.metadata.custom_fields? // {} | tostring)\nDESC: \(.description[0:600])\nCOLUMNS:", (.columns[] | "  \(.fieldName) [\(.dataTypeName)] - \(.name)")' $f
