#!/bin/sh
set -e
mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc mb --ignore-existing local/signflow-assets
# Scoped read-only policy: anonymous GetObject only on uploads/* prefix, not the whole bucket
mc anonymous set-json /init-policy.json local/signflow-assets
echo "MinIO bucket initialised."
