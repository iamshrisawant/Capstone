// prototyping/backend/fallbackLogger.js
const fs = require('fs').promises; // Use promise-based fs for async operations
const path = require('path');

const FEEDBACK_STORE_PATH = path.join(__dirname, 'feedbackStore.json');

/**
 * Logs a fallback event to the feedbackStore.json file.
 * @param {string} userQuery The original query from the user.
 * @param {object} llmPlan The LLM's initial plan (e.g., { intent: 'fallback' }).
 * @param {any} dbResult The result from the database (null if no DB call was made or failed).
 * @param {string} llmReply The reply sent back to the user (e.g., handoff message).
 * @param {string|null} humanReply The human agent's correction/reply (initially null).
 */
async function logFallback(userQuery, llmPlan, dbResult, llmReply, humanReply = null) {
    const fallbackEntry = {
        userQuery,
        llmPlan,
        dbResult, // Store raw DB result for context
        llmReply,
        humanReply,
        timestamp: new Date().toISOString() // ISO 8601 format for consistent timestamps
    };

    try {
        let feedbackData = [];
        // Check if file exists before reading
        try {
            const fileContent = await fs.readFile(FEEDBACK_STORE_PATH, 'utf8');
            feedbackData = JSON.parse(fileContent);
        } catch (readError) {
            // If file doesn't exist or is empty/corrupt, start with an empty array
            if (readError.code === 'ENOENT' || readError instanceof SyntaxError) {
                console.warn("feedbackStore.json not found or invalid, initializing new store.");
                feedbackData = [];
            } else {
                throw readError; // Re-throw other errors
            }
        }

        feedbackData.push(fallbackEntry);
        await fs.writeFile(FEEDBACK_STORE_PATH, JSON.stringify(feedbackData, null, 2), 'utf8');
        console.log("Fallback logged successfully to feedbackStore.json.");
    } catch (error) {
        console.error("Error logging fallback:", error);
    }
}

/**
 * Reads all fallback entries from the feedbackStore.json file.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of fallback entries.
 */
async function getFallbackEntries() {
    try {
        const fileContent = await fs.readFile(FEEDBACK_STORE_PATH, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("feedbackStore.json not found, returning empty array.");
            return []; // File not found is not an error for reading
        }
        console.error("Error reading feedback store:", error);
        return []; // Return empty array on other errors too
    }
}

/**
 * Updates a specific fallback entry with a human reply.
 * @param {string} timestamp The timestamp of the entry to update.
 * @param {string} humanReply The human agent's reply.
 * @returns {Promise<boolean>} True if updated, false otherwise.
 */
async function updateFallbackEntry(timestamp, humanReply) {
    try {
        let feedbackData = await getFallbackEntries();
        const entryIndex = feedbackData.findIndex(entry => entry.timestamp === timestamp);

        if (entryIndex > -1) {
            feedbackData[entryIndex].humanReply = humanReply;
            await fs.writeFile(FEEDBACK_STORE_PATH, JSON.stringify(feedbackData, null, 2), 'utf8');
            console.log(`Fallback entry with timestamp ${timestamp} updated successfully.`);
            return true;
        }
        console.warn(`Fallback entry with timestamp ${timestamp} not found for update.`);
        return false;
    } catch (error) {
        console.error("Error updating fallback entry:", error);
        return false;
    }
}

module.exports = {
    logFallback,
    getFallbackEntries,
    updateFallbackEntry
};
