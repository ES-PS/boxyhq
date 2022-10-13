#!/bin/bash

if [ "$RUN_MIGRATION" == "true" ]
then
    echo "Initiating Migration..."

    cd ./npm
    # && ts-node --transpile-only ./node_modules/typeorm/cli.js migration:run -d typeorm.ts
    if [ "$DB_ENGINE" = "mongo" ]
    then
        migrate-mongo up
    else
        ts-node --transpile-only ./node_modules/typeorm/cli.js migration:run -d typeorm.ts
    fi
    echo "Migration Finished..."

    cd ..
fi
echo "Starting Jackson service..."
node server.js