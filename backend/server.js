// prototyping/backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const chatHandler = require('./chatHandler');
const fallbackLogger = require('./fallbackLogger'); // For agent console endpoints
const neo4jClient = require('./neo4j'); // For graceful shutdown of Neo4j driver

// --- DOTENV DEBUGGING START ---
// Get the absolute path to the root .env file
const envPath = path.resolve(__dirname, '../.env');
console.log(`server.js: Attempting to load .env from: ${envPath}`);
require('dotenv').config({ path: envPath, debug: true }); // Enable debug logging for dotenv
// --- DOTENV DEBUGGING END ---

console.log("server.js: process.env.GEMINI_API_KEY =", process.env.GEMINI_API_KEY ? "Loaded" : "Not Loaded");
console.log("server.js: process.env.MCP_URL =", process.env.MCP_URL ? "Loaded" : "Not Loaded");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for frontend communication
app.use(express.json()); // Enable JSON body parsing for POST requests

// API Endpoint for Chat
app.post('/chat', async (req, res) => {
    const userQuery = req.body.query;
    if (!userQuery) {
        return res.status(400).json({ error: "Query is required in the request body." });
    }

    try {
        console.log(`Server: Received chat query: "${userQuery}"`);
        const reply = await chatHandler.handleChat(userQuery);
        res.json({ reply });
    } catch (error) {
        console.error("Server: Error in /chat endpoint:", error);
        res.status(500).json({ error: "Internal server error while processing chat." });
    }
});

// API Endpoint for Agent Console to get fallback entries
app.get('/fallbacks', async (req, res) => {
    try {
        console.log("Server: Received request for fallback entries.");
        const fallbacks = await fallbackLogger.getFallbackEntries();
        res.json(fallbacks);
    } catch (error) {
        console.error("Server: Error fetching fallbacks:", error);
        res.status(500).json({ error: "Failed to fetch fallback entries." });
    }
});

// API Endpoint for Agent Console to update a fallback entry
app.post('/fallbacks/update', async (req, res) => {
    const { timestamp, humanReply } = req.body;
    if (!timestamp || humanReply === undefined) {
        return res.status(400).json({ error: "Timestamp and humanReply are required in the request body." });
    }
    try {
        console.log(`Server: Received request to update fallback for timestamp: ${timestamp}`);
        const success = await fallbackLogger.updateFallbackEntry(timestamp, humanReply);
        if (success) {
            res.json({ message: "Fallback entry updated successfully." });
        } else {
            res.status(404).json({ error: "Fallback entry not found or could not be updated." });
        }
    } catch (error) {
        console.error("Server: Error updating fallback entry:", error);
        res.status(500).json({ error: "Failed to update fallback entry." });
    }
});


// --- STATIC FILE SERVING FIX START ---

// Serve the agent console's index.html specifically when the base URL is hit
app.get('/agent_console', (req, res) => {
    res.sendFile(path.join(__dirname, '../agent_console/index.html'));
});

// Serve all other static files (like console.js) from the agent_console directory
// This MUST come AFTER the specific route for index.html if you want to handle the root path.
app.use('/agent_console', express.static(path.join(__dirname, '../agent_console')));

// Serve static files for the main chat frontend
app.use(express.static(path.join(__dirname, '../public')));

// --- STATIC FILE SERVING FIX END ---


// Start the backend server
const server = app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Chat Frontend: http://localhost:${PORT}/index.html`);
    console.log(`Agent Console: http://localhost:${PORT}/agent_console/index.html`);
});

// Graceful shutdown of Neo4j driver and MCP driver (if applicable)
process.on('SIGINT', async () => {
    console.log('Server: Shutting down...');
    await neo4jClient.closeDriver(); // Close the backend's Neo4j driver
    // Note: The MCP server has its own driver and shutdown logic.
    server.close(() => {
        console.log('Server: Express server closed.');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('Server: Shutting down...');
    await neo4jClient.closeDriver();
    server.close(() => {
        console.log('Server: Express server closed.');
        process.exit(0);
    });
});
