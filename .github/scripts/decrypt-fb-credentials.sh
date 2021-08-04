#!/bin/sh

PUSH_FUNCTIONS_PATH=$HOME/cardstack/packages/firebase-functions/push/functions/src
# Decrypt the file
# --batch to prevent interactive command
# --yes to assume "yes" for questions
gpg --quiet --batch --yes --decrypt --passphrase="$FIREBASE_CREDENTIALS_PASSPHRASE" \
--output $PUSH_FUNCTIONS_PATH/service-account.json $PUSH_FUNCTIONS_PATH/service-account.gpg
