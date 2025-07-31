// prototyping/backend/neo4j.js
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '../.env' }); // Load environment variables from the root .env file

const URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// Create a driver instance. Ensure to close it when the application exits.
const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

/**
 * Executes a Cypher query against the Neo4j database.
 * @param {string} query The Cypher query string.
 * @param {object} params Optional parameters for the query.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of result records.
 */
async function executeCypher(query, params = {}) {
    const session = driver.session(); // Each session is for a single transaction
    try {
        const result = await session.run(query, params);
        // Map records to plain JavaScript objects for easier consumption
        return result.records.map(record => record.toObject());
    } catch (error) {
        console.error("Neo4j query failed:", error);
        throw error; // Re-throw to be handled by the caller
    } finally {
        await session.close(); // Always close the session
    }
}

/**
 * Closes the Neo4j driver connection.
 * Call this when your application is shutting down.
 */
async function closeDriver() {
    console.log("Closing Neo4j driver connection...");
    await driver.close();
    console.log("Neo4j driver closed.");
}

module.exports = {
    executeCypher,
    closeDriver,
    driver // Export driver for direct access if needed (e.g., for graceful shutdown)
};
