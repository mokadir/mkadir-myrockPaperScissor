# =============================================================================
# Dockerfile - Rock Paper Scissors Game
# Nginx alpine serving static game files
# =============================================================================

# Use a small, secure NGINX image to serve the static game
FROM nginx:stable-alpine

# Remove default static assets and add our game files
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html

# Expose the default HTTP port
EXPOSE 80

# Run NGINX in the foreground
CMD ["nginx", "-g", "daemon off;"]