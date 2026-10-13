#!/usr/bin/env bash
# Starts a local LanguageTool server on port 8081 (used for grammar/spelling feedback).
# First run downloads the jars (~250 MB) with Maven: ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -d lib ] || mvn -q dependency:copy-dependencies -DoutputDirectory=lib
exec java -Xmx1g -cp "lib/*" org.languagetool.server.HTTPServer --port "${LT_PORT:-8081}" --public --allow-origin "*"
