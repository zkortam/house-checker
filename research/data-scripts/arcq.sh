#!/bin/bash
# usage: arcq.sh <layer_url> <lon> <lat> [outFields]
curl -s -m 60 -G "$1/query" --data-urlencode "geometry=$2,$3" --data-urlencode "geometryType=esriGeometryPoint" --data-urlencode "inSR=4326" --data-urlencode "spatialRel=esriSpatialRelIntersects" --data-urlencode "outFields=${4:-*}" --data-urlencode "returnGeometry=false" --data-urlencode "f=json"
