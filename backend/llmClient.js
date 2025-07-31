// prototyping/backend/llmClient.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const feedbackProcessor = require('./feedbackProcessor'); // Import the new feedback processor

// --- DOTENV DEBUGGING START ---
const envPath = path.resolve(__dirname, '../.env');
console.log(`llmClient.js: Attempting to load .env from: ${envPath}`);
require('dotenv').config({ path: envPath, debug: true });
// --- DOTENV DEBUGGING END ---

console.log("llmClient.js: process.env.GEMINI_API_KEY =", process.env.GEMINI_API_KEY ? "Loaded" : "Not Loaded");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in the .env file. LLM functionality will be limited.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

// Base prompt for Phase 1: Intent + Cypher Plan
// This will be prepended with dynamic few-shot examples
const BASE_PLANNING_PROMPT = `You are an AI support agent. Your task is to understand the user's intent related to delivery queries and return a structured JSON response.

Based on the user's query, you must return either:
- A Cypher query to run on our Neo4j DB, along with the identified intent.
- Or "fallback" if the query cannot be answered by querying the database (e.g., general questions, refunds, or out-of-scope requests).

Your response MUST be a valid JSON object.

Database Entities and their properties:
- Customer: {id: STRING, name: STRING}
- Order: {id: STRING, status: STRING, eta: STRING, item: STRING}
- Relationships:
  - (Order)-[:PLACED_BY]->(Customer)

Examples of expected JSON output:

1. User Query: "Where is my order 10234?"
   Output:
   {
     "intent": "delivery_status",
     "cypher": "MATCH (o:Order {id: '10234'}) RETURN o.status AS status, o.eta AS eta, o.item AS item"
   }

2. User Query: "What's John Doe's customer ID?"
   Output:
   {
     "intent": "customer_info",
     "cypher": "MATCH (c:Customer {name: 'John Doe'}) RETURN c.id AS id"
   }

3. User Query: "Tell me about order 10234."
   Output:
   {
     "intent": "order_details",
     "cypher": "MATCH (o:Order {id: '10234'}) OPTIONAL MATCH (o)-[:PLACED_BY]->(c:Customer) RETURN o.id AS id, o.status AS status, o.eta AS eta, o.item AS item, c.name AS customerName"
   }

4. User Query: "What items did Jane Smith order?"
   Output:
   {
     "intent": "customer_orders",
     "cypher": "MATCH (c:Customer {name: 'Jane Smith'})<-[:PLACED_BY]-(o:Order) RETURN o.id AS orderId, o.item AS item, o.status AS status"
   }

5. User Query: "How do I get a refund?"
   Output:
   {
     "intent": "fallback"
   }

6. User Query: "Can I change my delivery address?"
   Output:
   {
     "intent": "fallback"
   }

---
`; // Added a separator for clarity between static and dynamic examples

/**
 * Analyzes the user's query to determine intent and generate a Cypher query or a fallback.
 * Communicates with the Gemini API, incorporating dynamically generated few-shot examples.
 * @param {string} userQuery The user's input query.
 * @returns {Promise<{intent: string, cypher?: string}>} A promise that resolves to an object
 * containing the intent and optionally a Cypher query.
 */
async function analyze(userQuery) {
    try {
        // Dynamically generate few-shot examples from the feedback store
        const dynamicExamples = await feedbackProcessor.generateFewShotExamples();

        // Combine dynamic examples with the base prompt
        const fullPrompt = dynamicExamples + BASE_PLANNING_PROMPT + `Now, process the following user query:\nUser Query: "${userQuery}"\nOutput:\n`;

        console.log("LLM Client: Sending planning prompt to Gemini API...");
        // console.log("--- Full Planning Prompt Sent to LLM ---");
        // console.log(fullPrompt); // Uncomment to see the full prompt in console
        // console.log("---------------------------------------");


        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const geminiResponseText = response.text();
        console.log("LLM Client: Received raw Gemini planning response:", geminiResponseText);

        try {
            const jsonMatch = geminiResponseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            console.warn("LLM Client: No valid JSON block found in Gemini planning response.");
            return { intent: "fallback" };
        } catch (jsonError) {
            console.error("LLM Client: Failed to parse Gemini planning JSON response:", jsonError);
            return { intent: "fallback" };
        }
    } catch (error) {
        console.error("LLM Client: Error in analyze function (Gemini API call):", error);
        return { intent: "fallback" };
    }
}

// Prompt for Phase 2: Natural Language Response Generation (remains unchanged)
const GENERATION_PROMPT = `You are an AI support agent. Your goal is to generate a user-friendly and concise natural language message based on the provided database query context and its results.

If the database result is empty or indicates no relevant information, state clearly that the information isn't available for the specific query. Avoid technical jargon.

User query context: "$USER_QUERY$"
Database result: $DB_RESULT$

Examples:

1. User Query: "Where is my order 10234?"
   DB Result: [{"status": "Shipped", "eta": "2025-08-02", "item": "Laptop"}]
   Response: "Your order 10234 (Laptop) has been shipped and is expected to arrive by August 2, 2025."

2. User Query: "What's the status of my order 99999?"
   DB Result: []
   Response: "I couldn't find any information for order 99999. Please double-check the order number."

3. User Query: "What's John Doe's customer ID?"
   DB Result: [{"id": "C001"}]
   Response: "John Doe's customer ID is C001."

4. User Query: "What items did Jane Smith order?"
   DB Result: [{"orderId": "10235", "item": "Smartphone", "status": "Processing"}]
   Response: "Jane Smith has an order (ID 10235) for a Smartphone, which is currently processing."

5. User Query: "Tell me about order 10236."
   DB Result: [{"id": "10236", "status": "Delivered", "eta": "2025-07-28", "item": "Headphones", "customerName": "John Doe"}]
   Response: "Order 10236 for Headphones, placed by John Doe, was delivered on July 28, 2025."

Generate a user-friendly message for the following:
Response:
`;

/**
 * Generates a natural language response based on the user's query context and database results.
 * Communicates with the Gemini API.
 * @param {string} userQueryContext The original user query.
 * @param {Array<Object>} dbResult The result obtained from the database.
 * @returns {Promise<string>} A promise that resolves to the natural language response.
 */
async function generateResponse(userQueryContext, dbResult) {
    try {
        const formattedDbResult = JSON.stringify(dbResult, null, 2);
        const prompt = GENERATION_PROMPT
            .replace('$USER_QUERY$', userQueryContext)
            .replace('$DB_RESULT$', formattedDbResult);

        console.log("LLM Client: Sending response generation prompt to Gemini API...");

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiResponseText = response.text();
        console.log("LLM Client: Received Gemini generation response:", geminiResponseText);
        return geminiResponseText.trim();
    } catch (error) {
        console.error("LLM Client: Error in generateResponse function (Gemini API call):", error);
        return "I apologize, but I encountered an issue generating a response. Please try again later.";
    }
}

module.exports = {
    analyze,
    generateResponse
};
