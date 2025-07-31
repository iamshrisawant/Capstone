// prototyping/mcp/mcp_server.js
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver'); // Neo4j driver for the MCP server
require('dotenv').config({ path: '../.env' }); // Load environment variables from the root .env file

const app = express();
const PORT = process.env.MCP_PORT || 5000; // MCP will run on port 5000 by default

// Load Neo4j connection details from .env
const URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// Create a Neo4j driver instance for the MCP server
const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

// Middleware
app.use(cors()); // Enable CORS for cross-origin requests from the backend
app.use(express.json()); // Parse JSON request bodies

/**
 * Executes a Cypher query against the Neo4j database.
 * This is a helper function for the MCP.
 * @param {string} query The Cypher query string.
 * @param {object} params Optional parameters for the query.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of result records.
 */
async function executeCypherInMcp(query, params = {}) {
    const session = driver.session();
    try {
        const result = await session.run(query, params);
        return result.records.map(record => record.toObject());
    } catch (error) {
        console.error("MCP: Neo4j query failed:", error);
        throw error;
    } finally {
        await session.close();
    }
}

// Endpoint for running Cypher queries
app.post('/run-neo4j-cypher', async (req, res) => {
    const { tool, cypher } = req.body;

    if (tool !== "run-neo4j-cypher" || !cypher) {
        return res.status(400).json({ error: "Invalid request payload. Expected {tool: 'run-neo4j-cypher', cypher: '...'}" });
    }

    try {
        console.log(`MCP: Executing Cypher query: ${cypher}`);
        const result = await executeCypherInMcp(cypher);
        res.json({ result });
    } catch (error) {
        console.error("MCP: Error processing /run-neo4j-cypher request:", error);
        res.status(500).json({ error: "Failed to execute Cypher query via MCP.", details: error.message });
    }
});

// Start the MCP server
app.listen(PORT, () => {
    console.log(`MCP server running on http://localhost:${PORT}`);
});

// Graceful shutdown of Neo4j driver when MCP server stops
process.on('SIGINT', async () => {
    console.log('MCP: Closing Neo4j driver...');
    await driver.close();
    console.log('MCP: Neo4j driver closed. Exiting.');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('MCP: Closing Neo4j driver...');
    await driver.close();
    console.log('MCP: Neo4j driver closed. Exiting.');
    process.exit(0);
});
