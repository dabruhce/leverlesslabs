#!/bin/bash
real_7za="$1"
shift
"$real_7za" "$@"
rc=$?
if [ $rc -eq 2 ]; then
  exit 0
fi
exit $rc
