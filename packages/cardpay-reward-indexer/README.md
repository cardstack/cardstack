
## Scripts 

You can check if the dbs are synced with s3 by

        DB_STRING="<tunnel db string>" ENVIRONMENT="staging" AWS_PROFILE="<staging profile>" pdm run check_sync
