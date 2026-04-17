# Use the official Nginx image
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy your static files to the nginx directory
COPY . /usr/share/nginx/html

# Expose port 80 (Nginx default)
EXPOSE 80

# Cloud Run injects a PORT environment variable (usually 8080)
# We use a simple shell command to replace Nginx's default 80 with the $PORT env var
CMD sed -i 's/80/'"$PORT"'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
