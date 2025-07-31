// prototyping/backend/mcpClient.js
const axios = require('axios');
require('dotenv').config({ path: '../.env' }); // Load environment variables from the root .env file

const MCP_URL = process.env.MCP_URL || 'http://localhost:5000'; // Default MCP URL from .env

/**
 * Sends a request to the MCP server to run a Cypher query.
 * @param {object} payload The payload containing 'tool', 'cypher', and optionally 'params' properties.
 * @param {string} payload.tool Should be "run-neo4j-cypher".
 * @param {string} payload.cypher The Cypher query string to execute.
 * @param {object} [payload.params={}] Optional parameters for the Cypher query.
 * @returns {Promise<Array<Object>>} A promise that resolves to the result from the Neo4j query.
 * @throws {Error} If the MCP request fails.
 */
async function run(payload) {
    try {
        console.log(`mcpClient: Sending request to MCP at ${MCP_URL}/run-neo4j-cypher with payload:`, payload);
        const response = await axios.post(`${MCP_URL}/run-neo4j-cypher`, payload);
        console.log("mcpClient: Received response from MCP:", response.data);
        if (response.data && response.data.result !== undefined) {
            return response.data.result;
        } else {
            throw new Error("MCP response missing 'result' field.");
        }
    } catch (error) {
        console.error("mcpClient: Error calling MCP:", error.response ? error.response.data : error.message);
        throw new Error(`Failed to communicate with MCP: ${error.message}`);
    }
}

module.exports = {
    run
};
