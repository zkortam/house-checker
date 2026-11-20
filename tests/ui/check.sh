#!/usr/bin/env bash
# design-digest section 2 greps for Plan B paths. Remaining hits are reviewed: themeColor meta needs literal hex; spin is the status loop; rise and toast are one-shot arrivals.
S="src/ui src/styles app"
echo "== raw colour"; grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(' $S --include=*.css --include=*.tsx --include=*.ts | grep -v tokens.css
echo "== literal motion"; grep -rnE '[0-9]+ms|cubic-bezier|ease-in-out|[^-]\bease\b' $S | grep -v tokens.css
echo "== cursor pointer"; grep -rnE 'cursor:\s*pointer|cursor-pointer' $S
echo "== zoom lock"; grep -rnE 'maximum-scale|user-scalable' $S
echo "== print"; grep -rnE '@media print|window\.print' $S
echo "== number input"; grep -rnE 'type="number"|type=\{?.number' $S
echo "== keyframes"; grep -rnE "animate-pulse|@keyframes" $S
echo "== copy"; grep -rniE "\bwe\b|\bour\b|please|simply|\bjust\b|!\"|successfully|something went wrong|N/A|\(s\)" src/ui/strings*
echo "== em dash"; grep -rn '—' src/ui/strings*
echo "== i18n"; grep -rnE "toLocaleString\(\)|new Date\('[0-9]{4}-[0-9]{2}-[0-9]{2}'\)|'en-US'" $S
echo "== silent catch"; grep -rnE "catch\s*(\([^)]*\))?\s*\{\s*\}" $S
echo "== history.back"; grep -rnE "history\.back\(\)" $S
echo "== bare controls"; grep -rnE "<(button|input|textarea|select)\b" $S | grep -v components/ui
echo "== physical props"; grep -rnE "margin-left|margin-right|padding-left|padding-right|\bleft:|\bright:|text-align:\s*(left|right)" $S
