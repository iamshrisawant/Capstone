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

When identifying products, be flexible. If a user mentions a partial name (e.g., "smart TV", "coffee maker"), try to map it to the closest full product name in the database (e.g., "4K Ultra HD Smart TV", "Smart Coffee Maker").

Based on the user's query and the conversation history, you must return either:
- A Cypher query to run on our Neo4j DB, along with the identified intent and any necessary parameters.
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

14. User Query: "Tell me about the coffee maker."
    Output:
    {
      "intent": "product_details",
      "cypher": "MATCH (p:Product {name: 'Smart Coffee Maker'}) OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category) RETURN p.id AS id, p.name AS name, p.description AS description, p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl, c.name AS category"
    }

15. User Query: "Tell me about the TV."
    Output:
    {
      "intent": "product_details",
      "cypher": "MATCH (p:Product {name: '4K Ultra HD Smart TV'}) OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category) RETURN p.id AS id, p.name AS name, p.description AS description, p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl, c.name AS category"
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

// Prompt for Phase 2: Natural Language Response Generation
const GENERATION_PROMPT = `You are an AI support agent for an e-commerce store. Your task is to generate a helpful and concise natural language response to the user's query, based on the provided database results.

User Query: "$USER_QUERY$"
Database Result:
$DB_RESULT$

Based on the above, provide a natural language answer. If the database result is empty or indicates no information, state that you couldn't find the requested information. For product details, provide a summary including name, description, price, stock, and category if available. For orders, provide status, date, and address. Format dates and currencies appropriately.

Examples:
1. User Query: "Where is my order 10234?"
   DB Result:
   [
     {
       "status": "Shipped",
       "orderDate": "2023-01-15T10:00:00Z",
       "shippingAddress": "123 Main St, Anytown, USA"
     }
   ]
   Response: Your order 10234 is currently Shipped. It was ordered on January 15, 2023, and is being shipped to 123 Main St, Anytown, USA.

2. User Query: "What's the price of Wireless Noise-Cancelling Headphones?"
   DB Result:
   [
     {
       "productName": "Wireless Noise-Cancelling Headphones",
       "price": 199.99
     }
   ]
   Response: The Wireless Noise-Cancelling Headphones are priced at $199.99.

3. User Query: "Tell me about the 4K Ultra HD Smart TV."
   DB Result:
   [
     {
       "id": "prod_456",
       "name": "4K Ultra HD Smart TV",
       "description": "Stunning 4K resolution with smart features.",
       "price": 799.00,
       "stock": 50,
       "imageUrl": "https://example.com/tv.jpg",
       "category": "Electronics"
     }
   ]
   Response: The 4K Ultra HD Smart TV is an Electronics product. It features stunning 4K resolution with smart features and is priced at $799.00. There are 50 units currently in stock.

4. User Query: "Show me reviews for the Smart Coffee Maker."
   DB Result:
   [
     {
       "rating": 5,
       "comment": "Excellent coffee maker!",
       "userName": "John Doe",
       "reviewDate": "2023-03-01T15:30:00Z"
     },
     {
       "rating": 4,
       "comment": "Good, but a bit slow.",
       "userName": "Jane Smith",
       "reviewDate": "2023-03-05T09:10:00Z"
     }
   ]
   Response: Here are some reviews for the Smart Coffee Maker:
   - John Doe (March 1, 2023): "Excellent coffee maker!" (Rating: 5/5)
   - Jane Smith (March 5, 2023): "Good, but a bit slow." (Rating: 4/5)

5. User Query: "What is my customer id?"
   DB Result:
   [
     {
       "userId": "user_123",
       "userName": "Test User",
       "userEmail": "test@example.com"
     }
   ]
   Response: Your customer ID is user_123. Your name is Test User and your email is test@example.com.

6. User Query: "What products are in the Books category?"
   DB Result: []
   Response: I couldn't find any products in the Books category. Please check the category name or try another category.

7. User Query: "Tell me about my cart."
   DB Result:
   [
     {
       "productId": "PROD_EL002",
       "productName": "4K Ultra HD Smart TV",
       "price": 799.99,
       "imageUrl": "https://placehold.co/300x200/007bff/ffffff?text=Smart+TV",
       "quantity": 1,
       "stock": 15
     }
   ]
   Response: Your cart contains: 1 x 4K Ultra HD Smart TV ($799.99 each).

8. User Query: "What can I chat with you about?"
   DB Result: []
   Response: I can help you with questions about our products (details, price, stock, reviews, categories), your orders (status, delivery, past purchases), or your customer ID. Just ask!
`;

/**
 * Analyzes the user's query to determine intent and generate a Cypher plan.
 * Communicates with the Gemini API.
 * @param {string} userQuery The user's input query.
 * @param {string|null} userId The ID of the authenticated user, or null if not logged in.
 * @param {Array<Object>} chatHistory The conversation history, if any, to provide context.
 * @returns {Promise<Object>} A promise that resolves to an object containing the intent, Cypher query, and parameters (or fallback).
 */
async function analyze(userQuery, userId = null, chatHistory = []) {
    try {
        const dynamicExamples = await feedbackProcessor.generateFewShotExamples();

        // Format chat history for the LLM prompt
        let formattedChatHistory = '';
        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
            formattedChatHistory += "\n--- Recent Conversation History ---\n";
            chatHistory.forEach(message => {
                formattedChatHistory += `${message.role === 'user' ? 'User' : 'AI'}: ${message.content}\n`;
            });
            formattedChatHistory += "-----------------------------------\n";
        }

        const userContext = userId ? `The current user's ID is: ${userId}.` : '';
        const fullPrompt = dynamicExamples + formattedChatHistory + BASE_PLANNING_PROMPT + `${userContext}\nNow, process the following user query:\nUser Query: "${userQuery}"\nOutput:\n`;

        console.log("LLM Client: Sending planning prompt to Gemini API...");
        // console.log("--- Full Planning Prompt Sent to LLM ---");
        // console.log(fullPrompt); // Uncomment to see the full prompt in console
        // console.log("---------------------------------------");

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const geminiResponseText = response.text();
        console.log("LLM Client: Received raw Gemini planning response:", geminiResponseText);

        // --- FIX START: Extract JSON using regex ---
        try {
            const jsonMatch = geminiResponseText.match(/```json\s*([\s\S]*?)\s*```/);
            let parsedResponse;
            if (jsonMatch && jsonMatch[1]) {
                parsedResponse = JSON.parse(jsonMatch[1]);
            } else {
                // Fallback if no markdown JSON block is found, try direct parse
                parsedResponse = JSON.parse(geminiResponseText);
            }

            // If the LLM generated a Cypher query that requires $userId, add it to params
            if (parsedResponse.cypher && parsedResponse.cypher.includes('$userId') && userId) {
                parsedResponse.params = { userId: userId };
            } else {
                parsedResponse.params = {}; // Ensure params is always an object, even if empty
            }
            return parsedResponse;
        } catch (jsonError) {
            console.error("LLM Client: Error parsing JSON from Gemini response:", jsonError);
            // If parsing fails, it's likely a malformed JSON or a non-JSON response.
            // Consider this a fallback case.
            return { intent: "fallback", message: "Could not parse Gemini's planning response." };
        }
        // --- FIX END ---

    } catch (error) {
        console.error("LLM Client: Error in analyze function (Gemini API call):", error);
        // Log feedback for analysis if the error is related to content filtering or other API issues.
        if (error.response && error.response.promptFeedback) {
            // Assuming feedbackProcessor has a logPromptFeedback method
            // feedbackProcessor.logPromptFeedback(userQuery, error.response.promptFeedback);
            console.error("LLM Client: Gemini API Prompt Feedback:", error.response.promptFeedback);
        }
        return { intent: "fallback", message: "I apologize, but I encountered an issue analyzing your request. Please try again later." };
    }
}


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
