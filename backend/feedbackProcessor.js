// prototyping/backend/feedbackProcessor.js
const fs = require('fs').promises;
const path = require('path');

const FEEDBACK_STORE_PATH = path.join(__dirname, 'feedbackStore.json');

/**
 * Reads the feedbackStore.json and processes entries with human replies
 * into a format suitable for LLM few-shot examples.
 *
 * @returns {Promise<string>} A promise that resolves to a string of
 * formatted few-shot examples, or an empty string if no relevant feedback.
 */
async function generateFewShotExamples() {
    try {
        const fileContent = await fs.readFile(FEEDBACK_STORE_PATH, 'utf8');
        const feedbackData = JSON.parse(fileContent);

        // Filter for entries that have a humanReply (i.e., they were resolved by an agent)
        const resolvedFeedbacks = feedbackData.filter(entry => entry.humanReply && entry.humanReply.trim() !== '');

        if (resolvedFeedbacks.length === 0) {
            console.log("FeedbackProcessor: No resolved feedback entries found to generate examples.");
            return "";
        }

        let examples = "";
        resolvedFeedbacks.forEach((entry, index) => {
            // Construct a clear example for the LLM based on the original query and human resolution
            examples += `\nExample ${index + 1} (from past human correction):\n`;
            examples += `User Query: "${entry.userQuery}"\n`;
            examples += `AI's Initial Reply (Fallback): "${entry.llmReply}"\n`;
            examples += `Human Agent's Correction/Response: "${entry.humanReply}"\n`;
            examples += `This indicates that for queries similar to "${entry.userQuery}", the correct approach is to provide the information or guidance as in the "Human Agent's Correction/Response".\n`;
        });

        console.log(`FeedbackProcessor: Generated ${resolvedFeedbacks.length} few-shot examples.`);
        return examples;

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn("FeedbackProcessor: feedbackStore.json not found. No examples generated.");
        } else {
            console.error("FeedbackProcessor: Error generating few-shot examples:", error);
        }
        return ""; // Return empty string on error or no file
    }
}

module.exports = {
    generateFewShotExamples
};
