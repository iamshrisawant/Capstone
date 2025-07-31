// prototyping/backend/chatHandler.js
const llmClient = require('./llmClient');
const mcpClient = require('./mcpClient');
const fallbackLogger = require('./fallbackLogger');

/**
 * Handles a user chat query, orchestrating the LLM, MCP, and fallback logic.
 * @param {string} userQuery The query received from the user.
 * @returns {Promise<string>} A promise that resolves to the natural language reply for the user.
 */
async function handleChat(userQuery) {
    let llmPlan = null;
    let dbResult = null;
    let llmReply = null;

    try {
        // Step 1: Accept user query (handled by the caller, e.g., server.js)

        // Step 2: Call llmClient.analyze(query) to get intent and Cypher plan
        console.log(`ChatHandler: Analyzing user query: "${userQuery}"`);
        llmPlan = await llmClient.analyze(userQuery);
        console.log("ChatHandler: LLM Plan received:", llmPlan);

        // Step 3: Check if LLM returned a fallback intent
        if (llmPlan.intent === 'fallback') {
            console.log("ChatHandler: LLM returned 'fallback' intent.");
            llmReply = "I'm sorry, I cannot directly answer that question. I'm connecting you to a human support agent who can assist you further.";
            // Log the fallback event
            await fallbackLogger.logFallback(userQuery, llmPlan, null, llmReply);
            return llmReply; // Return handoff message
        }
        // If LLM provided a Cypher query
        else if (llmPlan.cypher) {
            console.log(`ChatHandler: LLM provided Cypher query: "${llmPlan.cypher}"`);
            // Step 4: Call mcpClient.run(cypher) to execute query
            try {
                const payload = {
                    tool: "run-neo4j-cypher",
                    cypher: llmPlan.cypher
                };
                dbResult = await mcpClient.run(payload);
                console.log("ChatHandler: DB Result from MCP:", dbResult);
            } catch (mcpError) {
                console.error("ChatHandler: Error running Cypher via MCP:", mcpError);
                llmReply = "I encountered an issue retrieving information from our database. Please try again in a moment or consider rephrasing your query.";
                // Log this as a fallback scenario due to DB/MCP error
                await fallbackLogger.logFallback(userQuery, llmPlan, null, llmReply);
                return llmReply;
            }

            // Step 5: Send result back to llmClient.generateResponse() for natural language reply
            llmReply = await llmClient.generateResponse(userQuery, dbResult);
            console.log("ChatHandler: Final LLM reply generated:", llmReply);
            // No logging to feedbackStore here, as it was a successful LLM -> DB -> LLM flow
            return llmReply; // Return the final natural-language reply
        } else {
            // This case should ideally not happen if LLM always returns 'fallback' or 'cypher'
            console.warn("ChatHandler: Unexpected LLM plan structure:", llmPlan);
            llmReply = "I'm sorry, I couldn't understand your request due to an internal processing error. Please try again.";
            // Log this unexpected scenario as a fallback
            await fallbackLogger.logFallback(userQuery, llmPlan, null, llmReply);
            return llmReply;
        }

    } catch (error) {
        console.error("ChatHandler: An unexpected error occurred in handleChat:", error);
        llmReply = "An unexpected error occurred. Please try again later.";
        // Log any unhandled errors as a fallback
        await fallbackLogger.logFallback(userQuery, llmPlan, dbResult, llmReply);
        return llmReply;
    }
}

module.exports = {
    handleChat
};
