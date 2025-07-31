// prototyping/mcp/mcp_server.js
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.MCP_PORT || 5000;

const URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'password';

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint for running Cypher queries
app.post('/run-neo4j-cypher', async (req, res) => {
    const { tool, cypher, params = {} } = req.body; // Extract params, default to empty object

    if (tool !== "run-neo4j-cypher" || !cypher) {
        return res.status(400).json({ error: "Invalid request payload. Expected {tool: 'run-neo4j-cypher', cypher: '...', params: {...}}" });
    }

    // Use executeRead for read-only queries, executeWrite for write queries.
    // Since this endpoint is generic, we'll use a session and run.
    // For more robust handling, you might have separate endpoints for read/write.
    const session = driver.session();
    try {
        console.log(`MCP: Executing Cypher query: ${cypher} with params:`, params);
        const result = await session.run(cypher, params); // Pass params to session.run
        // Convert Neo4j result records to a list of dictionaries
        const records = result.records.map(record => record.toObject());
        res.json({ result: records });
    } catch (error) {
        console.error("MCP: Error executing Cypher query:", error);
        res.status(500).json({ error: "Failed to execute Cypher query via MCP.", details: error.message });
    } finally {
        await session.close();
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
