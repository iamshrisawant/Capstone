// prototyping/backend/orderService.js
const neo4jClient = require('./neo4j'); // Import the Neo4j client
const crypto = require('crypto'); // Node.js built-in for UUID generation

/**
 * Retrieves the current shopping cart for a given user.
 * The cart is represented by (:User)-[:HAS_IN_CART]->(:Product) relationships.
 * @param {string} userId The ID of the authenticated user.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of cart items.
 */
async function getCart(userId) {
    try {
        const query = `
            MATCH (u:User {id: $userId})-[r:HAS_IN_CART]->(p:Product)
            RETURN p.id AS productId, p.name AS productName, p.price AS price,
                   p.imageUrl AS imageUrl, r.quantity AS quantity, p.stock AS stock
        `;
        const params = { userId };
        const result = await neo4jClient.executeCypher(query, params);
        console.log(`OrderService: Fetched cart for user ${userId} with ${result.length} items.`);
        return result;
    } catch (error) {
        console.error(`OrderService: Error fetching cart for user ${userId}:`, error);
        throw new Error("Failed to retrieve shopping cart.");
    }
}

/**
 * Adds a product to the user's cart or updates its quantity if already present.
 * @param {string} userId The ID of the authenticated user.
 * @param {string} productId The ID of the product to add.
 * @param {number} quantity The quantity to add/set.
 * @returns {Promise<Object>} The updated cart item.
 */
async function addToCart(userId, productId, quantity) {
    try {
        // Ensure quantity is a positive number
        if (quantity <= 0) {
            throw new Error("Quantity must be a positive number.");
        }

        // Check product stock before adding to cart
        const stockCheckQuery = `
            MATCH (p:Product {id: $productId})
            RETURN p.stock AS stock
        `;
        const stockResult = await neo4jClient.executeCypher(stockCheckQuery, { productId });
        if (stockResult.length === 0) {
            throw new Error(`Product with ID ${productId} not found.`);
        }
        const availableStock = stockResult[0].stock;

        // Use MERGE to create or update the HAS_IN_CART relationship
        const query = `
            MATCH (u:User {id: $userId})
            MATCH (p:Product {id: $productId})
            MERGE (u)-[r:HAS_IN_CART]->(p)
            ON CREATE SET r.quantity = $quantity, r.addedAt = datetime()
            ON MATCH SET r.quantity = r.quantity + $quantity // Increment quantity if exists
            RETURN p.id AS productId, p.name AS productName, p.price AS price,
                   p.imageUrl AS imageUrl, r.quantity AS quantity, p.stock AS stock
        `;
        const params = { userId, productId, quantity };

        const result = await neo4jClient.executeCypher(query, params);

        if (result.length === 0) {
            throw new Error("Failed to add/update item in cart.");
        }
        console.log(`OrderService: User ${userId} added/updated product ${productId} in cart.`);
        return result[0];
    } catch (error) {
        console.error(`OrderService: Error adding product ${productId} to cart for user ${userId}:`, error);
        throw new Error(`Failed to add item to cart: ${error.message}`);
    }
}

/**
 * Removes a product from the user's cart.
 * @param {string} userId The ID of the authenticated user.
 * @param {string} productId The ID of the product to remove.
 * @returns {Promise<boolean>} True if removed successfully, false otherwise.
 */
async function removeFromCart(userId, productId) {
    try {
        const query = `
            MATCH (u:User {id: $userId})-[r:HAS_IN_CART]->(p:Product {id: $productId})
            DELETE r
            RETURN count(r) AS deletedCount
        `;
        const params = { userId, productId };
        const result = await neo4jClient.executeCypher(query, params);
        const deletedCount = result[0].deletedCount;
        if (deletedCount > 0) {
            console.log(`OrderService: User ${userId} removed product ${productId} from cart.`);
            return true;
        }
        console.log(`OrderService: Product ${productId} not found in cart for user ${userId}.`);
        return false;
    } catch (error) {
        console.error(`OrderService: Error removing product ${productId} from cart for user ${userId}:`, error);
        throw new Error("Failed to remove item from cart.");
    }
}

/**
 * Places a new order from the user's current cart items.
 * This involves creating an :Order node, linking it to the user,
 * creating :CONTAINS relationships to products, and clearing the cart.
 * Uses a Neo4j transaction for atomicity.
 * @param {string} userId The ID of the authenticated user.
 * @param {Array<Object>} cartItems An array of objects, each with productId and quantity.
 * @param {string} shippingAddress The shipping address for the order.
 * @returns {Promise<Object>} The newly created order object.
 */
async function placeOrder(userId, cartItems, shippingAddress) {
    if (!cartItems || cartItems.length === 0) {
        throw new Error("Cannot place an empty order. Cart is empty.");
    }
    if (!shippingAddress || shippingAddress.trim() === '') {
        throw new Error("Shipping address is required to place an order.");
    }

    // Use executeWrite to manage the transaction automatically
    const result = await neo4jClient.driver.executeWrite(async tx => {
        const orderId = `ORD_${crypto.randomUUID()}`;
        const orderDate = new Date().toISOString();
        let totalAmount = 0;

        // 1. Get product details and calculate total amount + check stock
        const productDetailsQuery = `
            UNWIND $cartItems AS item
            MATCH (p:Product {id: item.productId})
            RETURN p.id AS productId, p.name AS productName, p.price AS price, p.stock AS stock, item.quantity AS quantity
        `;
        const productDetailsResult = await tx.run(productDetailsQuery, { cartItems });

        if (productDetailsResult.records.length !== cartItems.length) {
            throw new Error("One or more products in the cart were not found.");
        }

        const itemsToOrder = productDetailsResult.records.map(record => {
            const data = record.toObject();
            if (data.quantity > data.stock) {
                throw new Error(`Not enough stock for product ${data.productName}. Available: ${data.stock}, Requested: ${data.quantity}`);
            }
            totalAmount += data.price * data.quantity;
            return {
                productId: data.productId,
                quantity: data.quantity,
                itemPrice: data.price
            };
        });

        // 2. Create the Order node and link to User
        const createOrderQuery = `
            MATCH (u:User {id: $userId})
            CREATE (o:Order {
                id: $orderId,
                status: 'Pending',
                orderDate: datetime($orderDate),
                totalAmount: $totalAmount,
                shippingAddress: $shippingAddress
            })
            CREATE (u)-[:PLACED]->(o)
            RETURN o.id AS id, o.status AS status, o.orderDate AS orderDate, o.totalAmount AS totalAmount, o.shippingAddress AS shippingAddress
        `;
        const createOrderParams = { userId, orderId, orderDate, totalAmount, shippingAddress };
        const orderCreationResult = await tx.run(createOrderQuery, createOrderParams);
        const newOrder = orderCreationResult.records[0].toObject();

        // 3. Create :CONTAINS relationships for each product in the order and update stock
        const createContainsQuery = `
            MATCH (o:Order {id: $orderId})
            UNWIND $itemsToOrder AS item
            MATCH (p:Product {id: item.productId})
            CREATE (o)-[c:CONTAINS {quantity: item.quantity, itemPrice: item.itemPrice}]->(p)
            SET p.stock = p.stock - item.quantity // Decrement stock
            RETURN count(c) AS relationshipsCreated
        `;
        await tx.run(createContainsQuery, { orderId, itemsToOrder });

        // 4. Clear the user's cart after placing the order
        const clearCartQuery = `
            MATCH (u:User {id: $userId})-[r:HAS_IN_CART]->(:Product)
            DELETE r
        `;
        await tx.run(clearCartQuery, { userId });

        console.log(`OrderService: Order ${orderId} placed successfully by user ${userId}.`);
        return newOrder; // Return the new order object
    });

    return result; // executeWrite returns the result of the callback
}

/**
 * Retrieves all orders placed by a specific user.
 * @param {string} userId The ID of the authenticated user.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of order objects.
 */
async function getUserOrders(userId) {
    try {
        const query = `
            MATCH (u:User {id: $userId})-[:PLACED]->(o:Order)
            RETURN o.id AS orderId, o.status AS status, o.orderDate AS orderDate,
                   o.totalAmount AS totalAmount, o.shippingAddress AS shippingAddress
            ORDER BY o.orderDate DESC
        `;
        const params = { userId };
        const result = await neo4jClient.executeCypher(query, params);
        console.log(`OrderService: Fetched ${result.length} orders for user ${userId}.`);
        return result;
    } catch (error) {
        console.error(`OrderService: Error fetching orders for user ${userId}:`, error);
        throw new Error("Failed to retrieve user orders.");
    }
}

/**
 * Retrieves details for a specific order, ensuring it belongs to the specified user.
 * @param {string} orderId The ID of the order.
 * @param {string} userId The ID of the authenticated user (for authorization).
 * @returns {Promise<Object|null>} A promise that resolves to the order details, or null if not found/authorized.
 */
async function getOrderDetails(orderId, userId) {
    try {
        const query = `
            MATCH (u:User {id: $userId})-[:PLACED]->(o:Order {id: $orderId})
            OPTIONAL MATCH (o)-[c:CONTAINS]->(p:Product)
            RETURN o.id AS orderId, o.status AS status, o.orderDate AS orderDate,
                   o.totalAmount AS totalAmount, o.shippingAddress AS shippingAddress,
                   COLLECT({
                       productId: p.id,
                       productName: p.name,
                       productPrice: c.itemPrice,
                       quantity: c.quantity,
                       imageUrl: p.imageUrl
                   }) AS items
        `;
        const params = { orderId, userId };
        const result = await neo4jClient.executeCypher(query, params);
        if (result.length > 0) {
            console.log(`OrderService: Fetched details for order ${orderId} for user ${userId}.`);
            return result[0];
        }
        console.log(`OrderService: Order ${orderId} not found or not placed by user ${userId}.`);
        return null;
    } catch (error) {
        console.error(`OrderService: Error fetching order ${orderId} for user ${userId}:`, error);
        throw new Error(`Failed to retrieve order details for order ${orderId}.`);
    }
}

/**
 * Cancels an order by updating its status.
 * Uses a Neo4j transaction for atomicity.
 * @param {string} orderId The ID of the order to cancel.
 * @param {string} userId The ID of the authenticated user (for authorization).
 * @returns {Promise<boolean>} True if cancelled successfully, false otherwise.
 */
async function cancelOrder(orderId, userId) {
    // Use executeWrite to manage the transaction automatically
    const result = await neo4jClient.driver.executeWrite(async tx => {
        // Find the order and ensure it belongs to the user and is in a cancellable status
        const checkOrderQuery = `
            MATCH (u:User {id: $userId})-[:PLACED]->(o:Order {id: $orderId})
            WHERE o.status IN ['Pending', 'Processing'] // Only cancellable if pending or processing
            RETURN o.id AS id, o.status AS status
        `;
        const checkResult = await tx.run(checkOrderQuery, { userId, orderId });

        if (checkResult.records.length === 0) {
            throw new Error(`Order ${orderId} not found, not placed by you, or not in a cancellable status.`);
        }

        // Update the order status to 'Cancelled'
        const updateStatusQuery = `
            MATCH (o:Order {id: $orderId})
            SET o.status = 'Cancelled', o.cancellationDate = datetime()
            RETURN o.id AS id, o.status AS status
        `;
        const updateResult = await tx.run(updateStatusQuery, { orderId });

        if (updateResult.records.length > 0) {
            // Re-stock the items if the order is cancelled
            const restockQuery = `
                MATCH (o:Order {id: $orderId})-[c:CONTAINS]->(p:Product)
                SET p.stock = p.stock + c.quantity
                RETURN count(p) AS restockedItemsCount
            `;
            await tx.run(restockQuery, { orderId });

            console.log(`OrderService: Order ${orderId} cancelled by user ${userId} and items restocked.`);
            return true;
        }
        return false; // Should not be reached if updateResult.records.length > 0
    });

    return result; // executeWrite returns the result of the callback
}

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    placeOrder,
    getUserOrders,
    getOrderDetails,
    cancelOrder
};
