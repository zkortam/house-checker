#!/bin/bash
# usage: q.sh <id> <where> [select] [limit] [order]
id=$1; w=$2; s=${3:-*}; l=${4:-1000}; o=$5
args=(-s -G "https://data.sf.gov/resource/$id.json" --data-urlencode "\$where=$w" --data-urlencode "\$select=$s" --data-urlencode "\$limit=$l")
[ -n "$o" ] && args+=(--data-urlencode "\$order=$o")
curl "${args[@]}"
