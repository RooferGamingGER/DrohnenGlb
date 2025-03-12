
#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Create admin user if it doesn't exist
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Creating admin user if it doesn't exist..."
  node src/scripts/create-admin.js
else
  echo "ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin user creation."
fi

# Execute the main CMD
exec "$@"
