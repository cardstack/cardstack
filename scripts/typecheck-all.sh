#!/bin/bash

for name in $(find packages -name node_modules -prune -o -name 'cardpay-subgraph' -prune -o -name 'tsconfig.json' -print); do
  {
  cd $(dirname $name)
  yarn -s tsc --noEmit
  code=$?
  [ $code -eq 0 ] && echo PASS "$name" || echo FAIL "$name"
  exit $code
  } &

done

combined_exit=0
for pid in $(jobs -p); do
  wait "$pid"
  code=$?
  if [ "$code" != "0" ]; then
    combined_exit=$code
  fi
done

exit $combined_exit
