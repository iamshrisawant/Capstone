# prototyping/mcp/Dockerfile
# Use a Node.js base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if you have one)
# to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your MCP server listens on
EXPOSE 5000

# Command to run your MCP server
CMD ["node", "mcp_server.js"]