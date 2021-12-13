#!/bin/bash

for name in `ls packages/*/tsconfig.json`; do 

  {
  cd `dirname $name`
  yarn tsc --noEmit
  code=$?
  if [ $code -eq 0 ]; 
  then
    echo PASS $name
    exit $code
  else    
    echo FAIL $name
    exit $code
  fi
  } &

done

combined_exit=0
for pid in `jobs -p`; do
  wait $pid
  code=$?
  if [ "$code" != "0" ]; then
    combined_exit=$code
  fi
done

exit $combined_exit
