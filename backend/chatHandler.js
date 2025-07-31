// prototyping/backend/chatHandler.js
const llmClient = require('./llmClient');
const mcpClient = require('./mcpClient');
const fallbackLogger = require('./fallbackLogger');

// Define a maximum number of turns to keep in memory to prevent prompt overflow
const MAX_CHAT_HISTORY_TURNS = 5; // Keep last 5 user-AI turn pairs

/**
 * Handles a user chat query, orchestrating the LLM, MCP, and fallback logic.
 * @param {string} userQuery The query received from the user.
 * @param {string|null} userId The ID of the authenticated user, or null if not logged in.
 * @param {object} session The Express session object for the current request.
 * @returns {Promise<string>} A promise that resolves to the natural language reply for the user.
 */
async function handleChat(userQuery, userId = null, session) { // Accept session parameter
    let llmPlan = null;
    let dbResult = null;
    let llmReply = null;

    // Initialize chat history for the session if it doesn't exist
    if (!session.chatHistory) {
        session.chatHistory = [];
    }

    try {
        // Add current user query to history before sending to LLM
        session.chatHistory.push({ role: 'user', content: userQuery });

        // Step 1: Accept user query (handled by caller)
        // Step 2: Call llmClient.analyze(query, userId, chatHistory) - Pass userId and chatHistory to LLM client
        console.log(`ChatHandler: Analyzing user query: "${userQuery}" for userId: ${userId}`);
        // Pass the entire chat history for the LLM to use as context
        llmPlan = await llmClient.analyze(userQuery, userId, session.chatHistory);
        console.log("ChatHandler: LLM Plan received:", llmPlan);

        // Step 3: Check if LLM returned a fallback intent
        if (llmPlan.intent === 'fallback') {
            console.log("ChatHandler: LLM returned 'fallback' intent.");
            llmReply = "I'm sorry, I cannot directly answer that question. I'm connecting you to a human support agent who can assist you further.";
            // Log the fallback event
            await fallbackLogger.logFallback(userQuery, llmPlan, null, llmReply);
        }
        // If LLM provided a Cypher query
        else if (llmPlan.cypher) {
            console.log(`ChatHandler: LLM provided Cypher query: "${llmPlan.cypher}"`);
            // Step 4: Call mcpClient.run(cypher, params) to execute query
            try {
                const payload = {
                    tool: "run-neo4j-cypher",
                    cypher: llmPlan.cypher,
                    params: llmPlan.params // Pass the parameters received from LLM client
                };
                dbResult = await mcpClient.run(payload);
                console.log("ChatHandler: DB Result from MCP:", dbResult);
            } catch (mcpError) {
                console.error("ChatHandler: Error running Cypher via MCP:", mcpError);
                llmReply = "I encountered an issue retrieving information from our database. Please try again in a moment or consider rephrasing your query.";
                // Log this as a fallback scenario due to DB/MCP error
                await fallbackLogger.logFallback(userQuery, llmPlan, null, llmReply);
            }

            // Step 5: Send result back to llmClient.generateResponse() for natural language reply
            if (!llmReply) { // Only generate if no error fallback occurred before
                llmReply = await llmClient.generateResponse(userQuery, dbResult);
            }
            console.log("ChatHandler: Final LLM reply generated:", llmReply);
        } else {
            // This case should ideally not happen if LLM always returns 'fallback' or 'cypher'
            console.warn("ChatHandler: Unexpected LLM plan structure:", llmPlan);
            llmReply = "I'm sorry, I couldn't understand your request due to an internal processing error. Please try again.";
            // Log this unexpected scenario as a fallback
            await fallbackLogger.logFallback(userQuery, llmPlan, null, llmReply);
        }

    } catch (error) {
        console.error("ChatHandler: An unexpected error occurred in handleChat:", error);
        llmReply = "An unexpected error occurred. Please try again later.";
        // Log any unhandled errors as a fallback
        await fallbackLogger.logFallback(userQuery, llmPlan, dbResult, llmReply);
    } finally {
        // Add AI's reply to history
        session.chatHistory.push({ role: 'assistant', content: llmReply });

        // Trim chat history to keep only the most recent turns
        if (session.chatHistory.length > MAX_CHAT_HISTORY_TURNS * 2) { // *2 because each turn has user and assistant messages
            session.chatHistory = session.chatHistory.slice(-MAX_CHAT_HISTORY_TURNS * 2);
        }
    }
    return llmReply;
}

module.exports = {
    handleChat
};
