// prototyping/backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const chatHandler = require('./chatHandler');
const fallbackLogger = require('./fallbackLogger');
const neo4jClient = require('./neo4j');
const authService = require('./authService');
const productService = require('./productService');
const orderService = require('./orderService'); // Import the new order service
require('dotenv').config({ path: '../.env', debug: true });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Session Middleware Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_development_only',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized: Please log in to access this resource.' });
};

// --- E-COMMERCE AUTH ROUTES ---
app.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required for registration.' });
    }
    try {
        const userData = await authService.registerUser(email, password, name);
        req.session.userId = userData.id;
        req.session.userName = userData.name;
        res.status(201).json({ message: 'User registered successfully.', userId: userData.id, userName: userData.name });
    } catch (error) {
        if (error.message.includes('email already exists')) {
            return res.status(409).json({ error: 'Registration failed: An account with this email already exists.' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required for login.' });
    }
    try {
        const userData = await authService.loginUser(email, password);
        req.session.userId = userData.uid;
        req.session.userName = userData.name;
        res.status(200).json({ message: 'Logged in successfully.', userId: userData.uid, userName: userData.name });
    } catch (error) {
        if (error.message.includes('Invalid email or password')) {
            return res.status(401).json({ error: 'Login failed: Invalid email or password.' });
        }
        res.status(401).json({ error: error.message });
    }
});

app.post('/logout', isAuthenticated, async (req, res) => {
    try {
        await authService.logoutUser();
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ error: 'Failed to log out due to session error.' });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Logged out successfully.' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/user/me', isAuthenticated, (req, res) => {
    res.json({ userId: req.session.userId, userName: req.session.userName });
});
// --- E-COMMERCE AUTH ROUTES END ---


// --- E-COMMERCE PRODUCT ROUTES ---
app.get('/products', async (req, res) => {
    try {
        const products = await productService.getAllProducts();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await productService.getProductById(productId);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/products/:id/reviews', async (req, res) => {
    const productId = req.params.id;
    try {
        const reviews = await productService.getProductReviews(productId);
        res.json(reviews);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- E-COMMERCE PRODUCT ROUTES END ---


// --- E-COMMERCE CART & ORDER ROUTES ---

// Get user's current cart
app.get('/cart', isAuthenticated, async (req, res) => {
    try {
        const cart = await orderService.getCart(req.session.userId);
        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add item to cart
app.post('/cart/add', isAuthenticated, async (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: 'Product ID and a positive quantity are required.' });
    }
    try {
        const updatedCartItem = await orderService.addToCart(req.session.userId, productId, quantity);
        res.status(200).json({ message: 'Item added to cart successfully.', item: updatedCartItem });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove item from cart
app.post('/cart/remove', isAuthenticated, async (req, res) => {
    const { productId } = req.body;
    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }
    try {
        const success = await orderService.removeFromCart(req.session.userId, productId);
        if (success) {
            res.status(200).json({ message: 'Item removed from cart successfully.' });
        } else {
            res.status(404).json({ message: 'Item not found in cart.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Place an order from the cart
app.post('/orders/place', isAuthenticated, async (req, res) => {
    const { cartItems, shippingAddress } = req.body; // cartItems should be an array like [{productId: '...', quantity: N}]
    if (!cartItems || cartItems.length === 0 || !shippingAddress) {
        return res.status(400).json({ error: 'Cart items and shipping address are required to place an order.' });
    }
    try {
        const newOrder = await orderService.placeOrder(req.session.userId, cartItems, shippingAddress);
        res.status(201).json({ message: 'Order placed successfully.', order: newOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all orders for the logged-in user
app.get('/orders/my', isAuthenticated, async (req, res) => {
    try {
        const orders = await orderService.getUserOrders(req.session.userId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get details for a specific order by ID (ensuring it belongs to the user)
app.get('/orders/:id', isAuthenticated, async (req, res) => {
    const orderId = req.params.id;
    try {
        const orderDetails = await orderService.getOrderDetails(orderId, req.session.userId);
        if (orderDetails) {
            res.json(orderDetails);
        } else {
            res.status(404).json({ message: `Order with ID ${orderId} not found or not authorized.` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel an order
app.post('/orders/:id/cancel', isAuthenticated, async (req, res) => {
    const orderId = req.params.id;
    try {
        const success = await orderService.cancelOrder(orderId, req.session.userId);
        if (success) {
            res.status(200).json({ message: `Order ${orderId} cancelled successfully.` });
        } else {
            res.status(400).json({ message: `Could not cancel order ${orderId}. It might not be cancellable.` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- E-COMMERCE CART & ORDER ROUTES END ---


// API Endpoint for Chat (modified to pass userId and session to chatHandler)
app.post('/chat', async (req, res) => {
    const userQuery = req.body.query;
    const userId = req.session.userId || null; // userId will be null if not logged in
    if (!userQuery) {
        return res.status(400).json({ error: "Query is required in the request body." });
    }

    try {
        console.log(`Server: Received chat query: "${userQuery}" from userId: ${userId}`);
        // Pass req.session directly to chatHandler
        const reply = await chatHandler.handleChat(userQuery, userId, req.session);
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
            res.status(404).json({ message: "Fallback entry not found or could not be updated." });
        }
    } catch (error) {
        console.error("Server: Error updating fallback entry:", error);
        res.status(500).json({ error: "Failed to update fallback entry." });
    }
});


// --- STATIC FILE SERVING ---
app.get('/agent_console', (req, res) => {
    res.sendFile(path.join(__dirname, '../agent_console/index.html'));
});

app.use('/agent_console', express.static(path.join(__dirname, '../agent_console')));
app.use(express.static(path.join(__dirname, '../public')));


// Start the backend server
const server = app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Chat/E-commerce Frontend: http://localhost:${PORT}/index.html`);
    console.log(`Agent Console: http://localhost:${PORT}/agent_console/index.html`);
});

// Graceful shutdown of Neo4j driver and MCP driver (if applicable)
process.on('SIGINT', async () => {
    console.log('Server: Shutting down...');
    await neo4jClient.closeDriver();
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
