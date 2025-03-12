
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the code
COPY . .

# Create uploads directory for file storage
RUN mkdir -p uploads

# Add script to create admin user on startup
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Start application with our custom entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
