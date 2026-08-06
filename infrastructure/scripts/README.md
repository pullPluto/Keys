# Infrastructure scripts

`provision-cloudflare.sh` is intentionally explicit and non-destructive: it creates only the three named storage resources, prints Cloudflare's returned identifiers, and leaves configuration/deployment/migrations to a reviewed operator. It may fail if resources already exist; inspect account state before rerunning. It contains no cleanup command because deleting control-plane storage is destructive and requires explicit scope and recovery evidence.
