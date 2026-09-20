#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
set -eu
CONCEPT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec "$CONCEPT_ROOT/dist/Sierra Dev.app/Contents/MacOS/zen" -no-remote -purgecaches -profile "$CONCEPT_ROOT/.concept-profile" "$@"
