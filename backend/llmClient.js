// prototyping/backend/llmClient.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const feedbackProcessor = require('./feedbackProcessor'); // Import the feedback processor

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
// This will be prepended with dynamic few-shot examples and chat history
const BASE_PLANNING_PROMPT = `You are an AI support agent for an e-commerce store. Your task is to understand the user's intent related to products, orders, and general queries. Return a structured JSON response.

Based on the user's query, you must return either:
- A Cypher query to run on our Neo4j DB, along with the identified intent.
- Or "fallback" if the query cannot be answered by querying the database (e.g., general questions, refunds, or out-of-scope requests like "What can I ask you about?").

Your response MUST be a valid JSON object.

Database Entities and their properties:
- User: {id: STRING, email: STRING, name: STRING, passwordHash: STRING, createdAt: DATETIME}
- Product: {id: STRING, name: STRING, description: STRING, price: FLOAT, stock: INTEGER, imageUrl: STRING}
- Category: {name: STRING}
- Order: {id: STRING, status: STRING, orderDate: DATETIME, totalAmount: FLOAT, shippingAddress: STRING, trackingNumber: STRING, deliveryDate: DATETIME, cancellationDate: DATETIME}
- Review: {id: STRING, rating: INTEGER, comment: STRING, reviewDate: DATETIME}

Relationships:
- (User)-[:PLACED]->(Order)
- (Order)-[:CONTAINS {quantity: INTEGER, itemPrice: FLOAT}]->(Product)
- (Product)-[:HAS_CATEGORY]->(Category)
- (User)-[:WROTE]->(Review)
- (Review)-[:REVIEWS]->(Product)

Examples of expected JSON output:

1. User Query: "Where is my order 10234?"
   Output:
   {
     "intent": "delivery_status",
     "cypher": "MATCH (o:Order {id: '10234'}) RETURN o.status AS status, o.orderDate AS orderDate, o.shippingAddress AS shippingAddress"
   }

2. User Query: "What's the price of Wireless Noise-Cancelling Headphones?"
   Output:
   {
     "intent": "product_price",
     "cypher": "MATCH (p:Product {name: 'Wireless Noise-Cancelling Headphones'}) RETURN p.name AS productName, p.price AS price"
   }

3. User Query: "Tell me about the 4K Ultra HD Smart TV."
   Output:
   {
     "intent": "product_details",
     "cypher": "MATCH (p:Product {name: '4K Ultra HD Smart TV'}) OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category) RETURN p.id AS id, p.name AS name, p.description AS description, p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl, c.name AS category"
   }

4. User Query: "Show me reviews for the Smart Coffee Maker."
   Output:
   {
     "intent": "product_reviews",
     "cypher": "MATCH (p:Product {name: 'Smart Coffee Maker'})<-[:REVIEWS]-(r:Review)<-[:WROTE]-(u:User) RETURN r.rating AS rating, r.comment AS comment, u.name AS userName, r.reviewDate AS reviewDate"
   }

5. User Query: "What products are in the Electronics category?"
   Output:
   {
     "intent": "products_by_category",
     "cypher": "MATCH (c:Category {name: 'Electronics'})<-[:HAS_CATEGORY]-(p:Product) RETURN p.id AS productId, p.name AS productName, p.price AS price"
   }

6. User Query: "What is the stock level for Unisex Running Shoes?"
   Output:
   {
     "intent": "product_stock",
     "cypher": "MATCH (p:Product {name: 'Unisex Running Shoes'}) RETURN p.name AS productName, p.stock AS stock"
   }

7. User Query: "How do I get a refund?"
   Output:
   {
     "intent": "fallback"
   }

8. User Query: "Can I cancel order ORD_A001?"
   Output:
   {
     "intent": "cancel_order_status",
     "cypher": "MATCH (o:Order {id: 'ORD_A001'}) RETURN o.status AS status"
   }

9. User Query: "What orders has Alice Smith placed?"
   Output:
   {
     "intent": "user_orders",
     "cypher": "MATCH (u:User {name: 'Alice Smith'})-[:PLACED]->(o:Order) RETURN o.id AS orderId, o.status AS status, o.orderDate AS orderDate, o.totalAmount AS totalAmount ORDER BY o.orderDate DESC"
   }

10. User Query: "Tell me about my orders."
    Output:
    {
      "intent": "user_orders_current",
      "cypher": "MATCH (u:User {id: $userId})-[:PLACED]->(o:Order) RETURN o.id AS orderId, o.status AS status, o.orderDate AS orderDate, o.totalAmount AS totalAmount ORDER BY o.orderDate DESC"
    }

11. User Query: "What is my customer id?"
    Output:
    {
      "intent": "user_id",
      "cypher": "MATCH (u:User {id: $userId}) RETURN u.id AS userId, u.name AS userName, u.email AS userEmail"
    }

12. User Query: "Tell me about the product catalog."
    Output:
    {
      "intent": "product_catalog",
      "cypher": "MATCH (p:Product) RETURN p.name AS productName, p.price AS price, p.imageUrl AS imageUrl ORDER BY p.name ASC"
    }

13. User Query: "What products have I purchased?"
    Output:
    {
      "intent": "user_purchased_products",
      "cypher": "MATCH (u:User {id: $userId})-[:PLACED]->(o:Order)-[r:CONTAINS]->(p:Product) RETURN p.name AS productName, r.quantity AS quantity, p.price AS itemPrice, o.id AS orderId, o.orderDate AS orderDate ORDER BY o.orderDate DESC, p.name ASC"
    }

14. User Query: "Tell me about the Smart Coffee Maker."
    Output:
    {
      "intent": "product_details",
      "cypher": "MATCH (p:Product {name: 'Smart Coffee Maker'}) OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category) RETURN p.id AS id, p.name AS name, p.description AS description, p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl, c.name AS category"
    }

15. User Query: "Tell me about coffee products."
    Output:
    {
      "intent": "products_by_category",
      "cypher": "MATCH (c:Category {name: 'Home Goods'})<-[:HAS_CATEGORY]-(p:Product {name: 'Smart Coffee Maker'}) RETURN p.id AS productId, p.name AS productName, p.price AS price"
    }

16. User Query: "What about it?" (Follow-up to "Tell me about the Smart Coffee Maker.")
    Output:
    {
        "intent": "product_details",
        "cypher": "MATCH (p:Product {name: 'Smart Coffee Maker'}) OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category) RETURN p.id AS id, p.name AS name, p.description AS description, p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl, c.name AS category"
    }

17. User Query: "Why is it pending?" (Follow-up to order status query)
    Output:
    {
        "intent": "order_status_reason",
        "cypher": "MATCH (o:Order {id: $lastOrderId}) RETURN o.status AS status, o.orderDate AS orderDate"
    }
    // Note: $lastOrderId would need to be extracted from previous AI response or context.
    // For now, LLM needs to be trained to ask for ID if not in history.

---
`; // Added a separator for clarity between static and dynamic examples

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
