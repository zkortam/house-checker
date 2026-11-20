#!/bin/bash
# usage: s.sh <id> key=value ...   (keys like select, where, group, order, limit; $ prefix added)
id=$1; shift
args=(-s -G "https://data.sf.gov/resource/$id.json")
for kv in "$@"; do args+=(--data-urlencode "\$$kv"); done
curl "${args[@]}"
