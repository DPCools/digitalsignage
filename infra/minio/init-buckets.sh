#!/bin/sh
set -e
mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc mb --ignore-existing local/signflow-assets
mc anonymous set download local/signflow-assets
echo "MinIO bucket initialised."
