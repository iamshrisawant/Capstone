// prototyping/backend/productService.js
const neo4jClient = require('./neo4j'); // Import the Neo4j client

/**
 * Retrieves all products from the database.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of product objects.
 */
async function getAllProducts() {
    try {
        const query = `
            MATCH (p:Product)
            OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category)
            RETURN p.id AS id, p.name AS name, p.description AS description,
                   p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl,
                   c.name AS category
            ORDER BY p.name ASC
        `;
        const result = await neo4jClient.executeCypher(query);
        console.log(`ProductService: Fetched ${result.length} products.`);
        return result;
    } catch (error) {
        console.error("ProductService: Error fetching all products:", error);
        throw new Error("Failed to retrieve products.");
    }
}

/**
 * Retrieves a single product by its ID.
 * @param {string} productId The ID of the product.
 * @returns {Promise<Object|null>} A promise that resolves to the product object, or null if not found.
 */
async function getProductById(productId) {
    try {
        const query = `
            MATCH (p:Product {id: $productId})
            OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category)
            RETURN p.id AS id, p.name AS name, p.description AS description,
                   p.price AS price, p.stock AS stock, p.imageUrl AS imageUrl,
                   c.name AS category
        `;
        const params = { productId };
        const result = await neo4jClient.executeCypher(query, params);
        if (result.length > 0) {
            console.log(`ProductService: Fetched product by ID: ${productId}`);
            return result[0];
        }
        console.log(`ProductService: Product with ID ${productId} not found.`);
        return null;
    } catch (error) {
        console.error(`ProductService: Error fetching product by ID ${productId}:`, error);
        throw new Error(`Failed to retrieve product with ID ${productId}.`);
    }
}

/**
 * Retrieves reviews for a specific product by its ID.
 * @param {string} productId The ID of the product.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of review objects.
 */
async function getProductReviews(productId) {
    try {
        const query = `
            MATCH (p:Product {id: $productId})<-[:REVIEWS]-(r:Review)<-[:WROTE]-(u:User)
            RETURN r.id AS reviewId, r.rating AS rating, r.comment AS comment,
                   r.reviewDate AS reviewDate, u.name AS userName, u.id AS userId
            ORDER BY r.reviewDate DESC
        `;
        const params = { productId };
        const result = await neo4jClient.executeCypher(query, params);
        console.log(`ProductService: Fetched ${result.length} reviews for product ${productId}.`);
        return result;
    } catch (error) {
        console.error(`ProductService: Error fetching reviews for product ${productId}:`, error);
        throw new Error(`Failed to retrieve reviews for product ${productId}.`);
    }
}

module.exports = {
    getAllProducts,
    getProductById,
    getProductReviews
};
