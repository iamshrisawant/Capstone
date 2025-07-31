    // prototyping/public/ecom.js

    // Base URL for your backend API
    const BACKEND_URL = 'http://localhost:3000';

    // --- DOM Element References ---
    // Navigation Buttons
    const navProductsBtn = document.getElementById('nav-products');
    const navCartBtn = document.getElementById('nav-cart');
    const navOrdersBtn = document.getElementById('nav-orders');
    const navLoginBtn = document.getElementById('nav-login');
    const navRegisterBtn = document.getElementById('nav-register');
    const navLogoutBtn = document.getElementById('nav-logout');

    // Top-right user info/auth links
    const authLinksContainer = document.getElementById('auth-links');
    const userInfoContainer = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const cartCountSpan = document.getElementById('cart-count');

    // Main Content Sections
    const authSection = document.getElementById('auth-section');
    const productsSection = document.getElementById('products-section');
    const productDetailSection = document.getElementById('product-detail-section');
    const cartSection = document.getElementById('cart-section');
    const ordersSection = document.getElementById('orders-section');

    // Auth Form Elements
    const authTitle = document.getElementById('auth-title');
    const authForm = document.getElementById('auth-form');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authNameField = document.getElementById('name-field'); // Div containing name input
    const authNameInput = document.getElementById('auth-name');
    const authSubmitBtn = document.getElementById('auth-submit');
    const authMessage = document.getElementById('auth-message');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');

    // Product Section Elements
    const productListDiv = document.getElementById('product-list');
    const backToProductsBtn = document.getElementById('back-to-products');
    const productDetailContentDiv = document.getElementById('product-detail-content');

    // Cart Section Elements
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const proceedToCheckoutBtn = document.getElementById('proceed-to-checkout');
    const checkoutFormContainer = document.getElementById('checkout-form-container');
    const checkoutForm = document.getElementById('checkout-form');
    const shippingAddressInput = document.getElementById('shipping-address');
    const placeOrderBtn = document.getElementById('place-order-button');
    const orderMessage = document.getElementById('order-message');

    // Orders Section Elements
    const orderListDiv = document.getElementById('order-list');

    // Chatbot Overlay Elements
    const chatbotBubbleBtn = document.getElementById('chatbot-bubble');
    const chatbotOverlayDiv = document.getElementById('chatbot-overlay');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatMessagesDiv = document.getElementById('chat-messages'); // This is now inside the overlay
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('chat-send-button');

    // Custom Alert Elements
    const customAlertContainer = document.getElementById('custom-alert-container');


    // --- Global State Variables ---
    let currentUserId = null;
    let currentUserName = null;
    let isRegisterMode = false; // To toggle between login/register forms


    // --- Utility Functions ---

    /**
     * Hides all main content sections.
     */
    function hideAllSections() {
        authSection.classList.add('hidden');
        productsSection.classList.add('hidden');
        productDetailSection.classList.add('hidden');
        cartSection.classList.add('hidden');
        ordersSection.classList.add('hidden');
        // Ensure chatbot overlay is hidden when navigating to other main sections
        // This is handled by the explicit `showSection` calls for main content.
        // chatbotOverlayDiv.classList.add('hidden'); // Removed from here as it's handled by showSection
        console.log("hideAllSections: All main content sections hidden.");
    }

    /**
     * Shows a specific section and hides all others.
     * @param {HTMLElement} section The section element to show.
     */
    function showSection(section) {
        hideAllSections(); // Hide all first
        section.classList.remove('hidden'); // Then show the desired one
        console.log(`showSection: Displaying section: ${section.id}`);
        // Ensure chatbot overlay is hidden if a main content section is shown
        if (section !== chatbotOverlayDiv) {
            chatbotOverlayDiv.classList.add('hidden');
            console.log("showSection: Chatbot overlay hidden as a main section is now visible.");
        }
    }

    /**
     * Displays a custom alert message.
     * @param {string} message The message to display.
     * @param {'success'|'error'} type The type of alert (controls color).
     * @param {number} duration How long the alert should be visible in milliseconds.
     */
    function showAlert(message, type = 'success', duration = 3000) {
        const alertItem = document.createElement('div');
        alertItem.className = `custom-alert-item ${type === 'success' ? 'custom-alert-success' : 'custom-alert-error'}`;
        alertItem.innerHTML = `
            <span>${message}</span>
            <button class="custom-alert-close">&times;</button>
        `;

        customAlertContainer.appendChild(alertItem);

        // Auto-remove after duration
        const timeoutId = setTimeout(() => {
            alertItem.remove();
        }, duration);

        // Allow manual close
        alertItem.querySelector('.custom-alert-close').addEventListener('click', () => {
            alertItem.remove();
            clearTimeout(timeoutId); // Clear auto-remove timeout if manually closed
        });
        console.log(`showAlert: Displaying ${type} alert: ${message}`);
    }


    /**
     * Displays a message in the authentication form (separate from global alerts).
     * @param {string} message The message to display.
     * @param {boolean} isError True if it's an error message (red text), false for success.
     */
    function displayAuthMessage(message, isError) {
        authMessage.textContent = message;
        authMessage.className = `text-center mt-4 ${isError ? 'text-red-500' : 'text-green-500'}`;
        console.log(`displayAuthMessage: ${isError ? 'Error' : 'Success'} on auth form: ${message}`);
    }

    /**
     * Updates the navigation bar based on user login status.
     */
    function updateAuthUI() {
        if (currentUserId) {
            authLinksContainer.classList.add('hidden');
            userInfoContainer.classList.remove('hidden');
            userNameSpan.textContent = `Welcome, ${currentUserName || 'User'}!`;
            console.log(`updateAuthUI: User logged in: ${currentUserName}`);
        } else {
            authLinksContainer.classList.remove('hidden');
            userInfoContainer.classList.add('hidden');
            userNameSpan.textContent = '';
            console.log("updateAuthUI: User logged out.");
        }
    }

    /**
     * Fetches current user info from the backend to update UI on page load.
     */
    async function fetchUserInfo() {
        console.log("fetchUserInfo: Checking user login status...");
        try {
            const response = await fetch(`${BACKEND_URL}/user/me`);
            if (response.ok) {
                const data = await response.json();
                currentUserId = data.userId;
                currentUserName = data.userName;
                updateAuthUI();
                showSection(productsSection); // Show products if logged in
                fetchProducts(); // Load products
                console.log("fetchUserInfo: User is logged in. Showing products.");
            } else {
                currentUserId = null;
                currentUserName = null;
                updateAuthUI();
                showSection(authSection); // Show auth if not logged in
                console.log("fetchUserInfo: User is NOT logged in. Showing auth section.");
            }
        } catch (error) {
            console.error('fetchUserInfo: Error fetching user info:', error);
            currentUserId = null;
            currentUserName = null;
            updateAuthUI();
            showSection(authSection); // Fallback to auth if API fails
            showAlert('Failed to verify login status. Please try logging in.', 'error');
        } finally {
            updateCartCount(); // Always update cart count after checking user info
        }
    }

    /**
     * Fetches the current cart count and updates the UI.
     */
    async function updateCartCount() {
        if (!currentUserId) {
            cartCountSpan.textContent = '0';
            console.log("updateCartCount: Cart count reset to 0: User not logged in.");
            return;
        }
        try {
            const response = await fetch(`${BACKEND_URL}/cart`);
            if (response.ok) {
                const cartItems = await response.json();
                cartCountSpan.textContent = cartItems.length.toString();
                console.log(`updateCartCount: Cart count updated: ${cartItems.length} items.`);
            } else {
                cartCountSpan.textContent = '0';
                console.error('updateCartCount: Failed to fetch cart for count update:', response.status);
            }
        } catch (error) {
            console.error('updateCartCount: Error updating cart count:', error);
            cartCountSpan.textContent = '0';
        }
    }


    // --- Event Handlers ---

    // Navigation Button Clicks
    navProductsBtn.addEventListener('click', () => {
        showSection(productsSection);
        fetchProducts(); // Reload products when navigating to product section
    });
    navCartBtn.addEventListener('click', () => {
        if (!currentUserId) {
            showAlert('Please log in to view your cart.', 'error');
            showSection(authSection);
            return;
        }
        showSection(cartSection);
        fetchCart(); // Load cart items
    });
    navOrdersBtn.addEventListener('click', () => {
        if (!currentUserId) {
            showAlert('Please log in to view your orders.', 'error');
            showSection(authSection);
            return;
        }
        showSection(ordersSection);
        fetchOrders(); // Load user orders
    });
    navLoginBtn.addEventListener('click', () => {
        isRegisterMode = false;
        updateAuthFormUI();
        showSection(authSection);
    });
    navRegisterBtn.addEventListener('click', () => {
        isRegisterMode = true;
        updateAuthFormUI();
        showSection(authSection);
    });

    // Logout Button
    navLogoutBtn.addEventListener('click', async () => {
        console.log("Logout button clicked.");
        try {
            const response = await fetch(`${BACKEND_URL}/logout`, { method: 'POST' });
            if (response.ok) {
                currentUserId = null;
                currentUserName = null;
                updateAuthUI();
                updateCartCount(); // Reset cart count
                showSection(authSection); // Redirect to login after logout
                showAlert('Logged out successfully.', 'success');
            } else {
                const errorData = await response.json();
                showAlert(errorData.message || 'Logout failed.', 'error');
            }
        } catch (error) {
            console.error('Error during logout:', error);
            showAlert('An error occurred during logout.', 'error');
        }
    });


    // Auth Form Submission (Login/Register)
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission
        console.log("Auth form submitted.");

        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        const name = authNameInput.value; // Only relevant for registration

        let endpoint = isRegisterMode ? '/register' : '/login';
        let payload = { email, password };
        if (isRegisterMode) {
            payload.name = name;
        }

        try {
            const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                currentUserId = data.userId;
                currentUserName = data.userName;
                updateAuthUI();
                updateCartCount(); // Update cart count after login
                showSection(productsSection); // Redirect to products on success
                showAlert(data.message, 'success'); // Use custom alert
                authForm.reset(); // Clear form fields
                console.log(`Auth successful: ${data.message}`);
            } else {
                displayAuthMessage(data.error || data.message || 'Authentication failed.', true); // Keep auth message for form-specific feedback
                console.error(`Auth failed: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Authentication error:', error);
            displayAuthMessage('An unexpected error occurred during authentication.', true);
        }
    });

    // Toggle between Login and Register modes
    toggleAuthModeBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        updateAuthFormUI();
        console.log(`Auth mode toggled to: ${isRegisterMode ? 'Register' : 'Login'}`);
    });

    /**
     * Updates the UI of the authentication form based on isRegisterMode.
     */
    function updateAuthFormUI() {
        if (isRegisterMode) {
            authTitle.textContent = 'Register';
            authSubmitBtn.textContent = 'Register';
            authNameField.classList.remove('hidden');
            toggleAuthModeBtn.textContent = "Already have an account? Login here.";
            authNameInput.setAttribute('required', 'required'); // Name is required for register
        } else {
            authTitle.textContent = 'Login';
            authSubmitBtn.textContent = 'Login';
            authNameField.classList.add('hidden');
            toggleAuthModeBtn.textContent = "Don't have an account? Register here.";
            authNameInput.removeAttribute('required'); // Name is not required for login
        }
        authMessage.textContent = ''; // Clear previous messages
        authForm.reset(); // Clear form fields
        console.log("Auth form UI updated.");
    }


    // --- Product Display Logic ---
    async function fetchProducts() {
        productListDiv.innerHTML = '<p class="text-center text-gray-600 col-span-full">Loading products...</p>';
        console.log("fetchProducts: Attempting to fetch products.");
        try {
            const response = await fetch(`${BACKEND_URL}/products`);
            if (response.ok) {
                const products = await response.json();
                productListDiv.innerHTML = ''; // Clear loading message
                if (products.length === 0) {
                    productListDiv.innerHTML = '<p class="text-center text-gray-600 col-span-full">No products found.</p>';
                    console.log("fetchProducts: No products found.");
                    return;
                }
                products.forEach(product => {
                    const productCard = document.createElement('div');
                    productCard.className = 'bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center';
                    productCard.innerHTML = `
                        <img src="${product.imageUrl || 'https://placehold.co/150x100?text=No+Image'}" alt="${product.name}" class="w-32 h-32 object-cover rounded-md mb-4">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">${product.name}</h3>
                        <p class="text-gray-600 text-sm mb-2">${product.category || 'Uncategorized'}</p>
                        <p class="text-xl font-bold text-blue-600 mb-4">$${product.price.toFixed(2)}</p>
                        <button data-product-id="${product.id}" class="view-product-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">View Details</button>
                        <button data-product-id="${product.id}" data-product-name="${product.name}" class="add-to-cart-btn bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm mt-2 transition-colors">Add to Cart</button>
                    `;
                    productListDiv.appendChild(productCard);
                });
                console.log(`fetchProducts: Successfully loaded ${products.length} products.`);

                // Add event listeners for "View Details" buttons
                document.querySelectorAll('.view-product-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const productId = e.target.dataset.productId;
                        fetchProductDetails(productId);
                    });
                });
                // Add event listeners for "Add to Cart" buttons
                document.querySelectorAll('.add-to-cart-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const productId = e.target.dataset.productId;
                        const productName = e.target.dataset.productName;
                        await handleAddToCart(productId, productName);
                    });
                });

            } else {
                productListDiv.innerHTML = '<p class="text-center text-red-500 col-span-full">Failed to load products.</p>';
                console.error('fetchProducts: Failed to load products:', response.status);
            }
        } catch (error) {
            console.error('fetchProducts: Error fetching products:', error);
            productListDiv.innerHTML = '<p class="text-center text-red-500 col-span-full">An error occurred while loading products.</p>';
        }
    }

    async function fetchProductDetails(productId) {
        productDetailContentDiv.innerHTML = '<p class="text-center text-gray-600">Loading product details...</p>';
        showSection(productDetailSection);
        console.log(`fetchProductDetails: Attempting to fetch details for product ID: ${productId}`);
        try {
            const response = await fetch(`${BACKEND_URL}/products/${productId}`);
            if (response.ok) {
                const product = await response.json();
                // Fetch reviews for the product
                const reviewsResponse = await fetch(`${BACKEND_URL}/products/${productId}/reviews`);
                const reviews = reviewsResponse.ok ? await reviewsResponse.json() : [];

                productDetailContentDiv.innerHTML = `
                    <div class="flex flex-col md:flex-row gap-6">
                        <div class="md:w-1/3">
                            <img src="${product.imageUrl || 'https://placehold.co/300x200?text=No+Image'}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg shadow-md">
                        </div>
                        <div class="md:w-2/3">
                            <h3 class="text-2xl font-bold text-gray-800 mb-2">${product.name}</h3>
                            <p class="text-gray-600 text-sm mb-2">${product.category || 'Uncategorized'}</p>
                            <p class="text-gray-700 mb-4">${product.description}</p>
                            <p class="text-3xl font-bold text-blue-600 mb-4">$${product.price.toFixed(2)}</p>
                            <p class="text-gray-600 mb-4">Stock: ${product.stock}</p>
                            <button data-product-id="${product.id}" data-product-name="${product.name}" class="add-to-cart-btn bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-lg transition-colors">Add to Cart</button>
                        </div>
                    </div>
                    <div class="mt-8">
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Customer Reviews</h4>
                        <div id="reviews-list" class="space-y-4">
                            ${reviews.length > 0 ? reviews.map(review => `
                                <div class="bg-gray-50 p-4 rounded-lg shadow-sm">
                                    <p class="font-semibold">${review.userName} - Rating: ${review.rating}/5</p>
                                    <p class="text-gray-700 text-sm">${review.comment}</p>
                                    <p class="text-gray-500 text-xs">${new Date(review.reviewDate).toLocaleDateString()}</p>
                                </div>
                            `).join('') : '<p class="text-gray-600">No reviews yet. Be the first to review this product!</p>'}
                        </div>
                    </div>
                `;
                // Add event listener for "Add to Cart" button on detail page
                document.querySelector('#product-detail-content .add-to-cart-btn').addEventListener('click', async (e) => {
                    const productId = e.target.dataset.productId;
                    const productName = e.target.dataset.productName;
                    await handleAddToCart(productId, productName);
                });
                console.log(`fetchProductDetails: Successfully loaded details for product ID: ${productId}`);

            } else {
                productDetailContentDiv.innerHTML = `<p class="text-center text-red-500">Product details not found for ID: ${productId}.</p>`;
                console.error(`fetchProductDetails: Product not found for ID ${productId}:`, response.status);
            }
        } catch (error) {
            console.error(`fetchProductDetails: Error fetching product details for ${productId}:`, error);
            productDetailContentDiv.innerHTML = `<p class="text-center text-red-500">An error occurred while loading product details.</p>`;
        }
    }

    backToProductsBtn.addEventListener('click', () => {
        showSection(productsSection);
        fetchProducts();
    });

    async function handleAddToCart(productId, productName) {
        if (!currentUserId) {
            showAlert('Please log in to add items to your cart.', 'error');
            showSection(authSection);
            return;
        }
        console.log(`handleAddToCart: Adding product ${productId} to cart.`);
        try {
            const response = await fetch(`${BACKEND_URL}/cart/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity: 1 }) // Always add 1 for now
            });
            if (response.ok) {
                showAlert(`${productName} added to cart!`, 'success');
                updateCartCount();
                console.log(`handleAddToCart: ${productName} added successfully.`);
            } else {
                const errorData = await response.json();
                showAlert(`Failed to add ${productName} to cart: ${errorData.error || errorData.message}`, 'error');
                console.error(`handleAddToCart: Failed to add ${productName}:`, errorData);
            }
        } catch (error) {
            console.error('handleAddToCart: Error adding to cart:', error);
            showAlert('An error occurred while adding to cart.', 'error');
        }
    }


    // --- Cart Display Logic ---
    async function fetchCart() {
        cartItemsDiv.innerHTML = '<p class="text-center text-gray-600">Loading cart...</p>';
        cartTotalSpan.textContent = '0.00';
        checkoutFormContainer.classList.add('hidden');
        orderMessage.textContent = '';
        console.log("fetchCart: Attempting to fetch cart.");

        if (!currentUserId) {
            cartItemsDiv.innerHTML = '<p class="text-center text-red-500">Please log in to view your cart.</p>';
            console.warn("fetchCart: User not logged in, cannot fetch cart.");
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/cart`);
            if (response.ok) {
                const cartItems = await response.json();
                if (cartItems.length === 0) {
                    cartItemsDiv.innerHTML = '<p class="text-center text-gray-600">Your cart is empty.</p>';
                    proceedToCheckoutBtn.classList.add('hidden');
                    console.log("fetchCart: Cart is empty.");
                    return;
                }

                let total = 0;
                cartItemsDiv.innerHTML = '';

                cartItems.forEach(item => {
                    const itemTotal = item.price * item.quantity;
                    total += itemTotal;
                    const cartItemDiv = document.createElement('div');
                    cartItemDiv.className = 'flex items-center justify-between p-4 border rounded-lg shadow-sm bg-gray-50';
                    cartItemDiv.innerHTML = `
                        <div class="flex items-center space-x-4">
                            <img src="${item.imageUrl || 'https://placehold.co/80x80?text=No+Image'}" alt="${item.productName}" class="w-20 h-20 object-cover rounded-md">
                            <div>
                                <h4 class="font-semibold text-gray-800">${item.productName}</h4>
                                <p class="text-gray-600 text-sm">$${item.price.toFixed(2)} x ${item.quantity}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="font-bold text-lg">$${itemTotal.toFixed(2)}</span>
                            <button data-product-id="${item.productId}" class="remove-from-cart-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors">Remove</button>
                        </div>
                    `;
                    cartItemsDiv.appendChild(cartItemDiv);
                });

                cartTotalSpan.textContent = total.toFixed(2);
                proceedToCheckoutBtn.classList.remove('hidden');
                console.log(`fetchCart: Successfully loaded ${cartItems.length} items. Total: $${total.toFixed(2)}`);

                // Add event listeners for "Remove" buttons
                document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const productId = e.target.dataset.productId;
                        handleRemoveFromCart(productId);
                    });
                });

            } else {
                cartItemsDiv.innerHTML = '<p class="text-center text-red-500">Failed to load cart. Please try again.</p>';
                console.error('fetchCart: Failed to load cart:', response.status);
            }
        } catch (error) {
            console.error('fetchCart: Error fetching cart:', error);
            cartItemsDiv.innerHTML = '<p class="text-center text-red-500">An error occurred while loading your cart.</p>';
        }
    }

    async function handleRemoveFromCart(productId) {
        if (!confirm('Are you sure you want to remove this item from your cart?')) {
            return;
        }
        console.log(`handleRemoveFromCart: Removing product ${productId} from cart.`);
        try {
            const response = await fetch(`${BACKEND_URL}/cart/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId })
            });
            if (response.ok) {
                showAlert('Item removed from cart.', 'success');
                fetchCart();
                updateCartCount();
                console.log(`handleRemoveFromCart: Product ${productId} removed successfully.`);
            } else {
                const errorData = await response.json();
                showAlert(`Failed to remove item: ${errorData.error || errorData.message}`, 'error');
                console.error(`handleRemoveFromCart: Failed to remove ${productId}:`, errorData);
            }
        }
        catch (error) {
            console.error('handleRemoveFromCart: Error removing from cart:', error);
            showAlert('An error occurred while removing from cart.', 'error');
        }
    }

    proceedToCheckoutBtn.addEventListener('click', () => {
        checkoutFormContainer.classList.remove('hidden');
        proceedToCheckoutBtn.classList.add('hidden');
        orderMessage.textContent = '';
        console.log("Proceed to checkout clicked. Showing checkout form.");
    });

    checkoutForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log("Checkout form submitted. Attempting to place order.");

        const shippingAddress = shippingAddressInput.value.trim();
        if (!shippingAddress) {
            orderMessage.textContent = 'Shipping address cannot be empty.';
            orderMessage.className = 'text-center text-red-500 mt-4';
            return;
        }

        let cartItems = [];
        try {
            const cartResponse = await fetch(`${BACKEND_URL}/cart`);
            if (cartResponse.ok) {
                cartItems = await cartResponse.json();
                cartItems = cartItems.map(item => ({ productId: item.productId, quantity: item.quantity }));
            } else {
                const errorData = await cartResponse.json();
                orderMessage.textContent = `Failed to get cart items before placing order: ${errorData.error || errorData.message}`;
                orderMessage.className = 'text-center text-red-500 mt-4';
                return;
            }
        } catch (error) {
            console.error('Error fetching cart before order:', error);
            orderMessage.textContent = 'An error occurred while preparing your order. Please try again.';
            orderMessage.className = 'text-center text-red-500 mt-4';
            return;
        }

        if (cartItems.length === 0) {
            orderMessage.textContent = 'Your cart is empty. Please add items before placing an order.';
            orderMessage.className = 'text-center text-red-500 mt-4';
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/orders/place`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cartItems, shippingAddress })
            });

            const data = await response.json();
            if (response.ok) {
                showAlert(`Order ${data.order.id} placed successfully!`, 'success');
                orderMessage.textContent = '';
                checkoutForm.reset();
                checkoutFormContainer.classList.add('hidden');
                proceedToCheckoutBtn.classList.remove('hidden');
                updateCartCount();
                fetchCart();
                fetchOrders();
                console.log(`Order placed successfully: ${data.order.id}`);
            } else {
                orderMessage.textContent = `Order failed: ${data.error || data.message}`;
                orderMessage.className = 'text-center text-red-500 mt-4';
                console.error('Error placing order:', data);
            }
        } catch (error) {
            console.error('Error placing order:', error);
            orderMessage.textContent = 'An unexpected error occurred while placing your order.';
            orderMessage.className = 'text-center text-red-500 mt-4';
        }
    });


    // --- Orders Display Logic ---
    async function fetchOrders() {
        orderListDiv.innerHTML = '<p class="text-center text-gray-600">Loading orders...</p>';
        console.log("fetchOrders: Attempting to fetch orders.");
        if (!currentUserId) {
            orderListDiv.innerHTML = '<p class="text-center text-red-500">Please log in to view your orders.</p>';
            console.warn("fetchOrders: User not logged in, cannot fetch orders.");
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/orders/my`);
            if (response.ok) {
                const orders = await response.json();
                if (orders.length === 0) {
                    orderListDiv.innerHTML = '<p class="text-center text-gray-600">You have no orders yet.</p>';
                    console.log("fetchOrders: No orders found for user.");
                    return;
                }

                orderListDiv.innerHTML = '';
                orders.forEach(order => {
                    const orderDiv = document.createElement('div');
                    orderDiv.className = 'bg-white p-4 rounded-lg shadow-md';
                    orderDiv.innerHTML = `
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="font-bold text-lg text-gray-800">Order ID: ${order.orderId}</h3>
                            <span class="px-3 py-1 rounded-full text-sm font-semibold ${order.status === 'Delivered' ? 'bg-green-100 text-green-800' : order.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                                ${order.status}
                            </span>
                        </div>
                        <p class="text-gray-600 text-sm">Date: ${new Date(order.orderDate).toLocaleDateString()} - Total: $${order.totalAmount.toFixed(2)}</p>
                        <p class="text-gray-600 text-sm">Shipping Address: ${order.shippingAddress}</p>
                        <div class="mt-2">
                            <button data-order-id="${order.orderId}" class="view-order-details-btn text-blue-600 hover:underline text-sm transition-colors">View Details</button>
                            ${order.status === 'Pending' || order.status === 'Processing' ? `<button data-order-id="${order.orderId}" class="cancel-order-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm ml-2 transition-colors">Cancel Order</button>` : ''}
                        </div>
                    `;
                    orderListDiv.appendChild(orderDiv);
                });
                console.log(`fetchOrders: Successfully loaded ${orders.length} orders.`);

                // Add event listeners for "View Details" and "Cancel Order" buttons
                document.querySelectorAll('.view-order-details-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const orderId = e.target.dataset.orderId;
                        showAlert(`Viewing details for order: ${orderId}. (Functionality to be expanded)`, 'success');
                    });
                });
                document.querySelectorAll('.cancel-order-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const orderId = e.target.dataset.orderId;
                        handleCancelOrder(orderId);
                    });
                });

            } else {
                orderListDiv.innerHTML = '<p class="text-center text-red-500">Failed to load orders. Please try again.</p>';
                console.error('fetchOrders: Failed to load orders:', response.status);
            }
        } catch (error) {
            console.error('fetchOrders: Error fetching orders:', error);
            orderListDiv.innerHTML = '<p class="text-center text-red-500">An error occurred while loading your orders.</p>';
        }
    }

    async function handleCancelOrder(orderId) {
        if (!confirm(`Are you sure you want to cancel order ${orderId}?`)) {
            return;
        }
        console.log(`handleCancelOrder: Cancelling order ${orderId}.`);
        try {
            const response = await fetch(`${BACKEND_URL}/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                showAlert(`Order ${orderId} cancelled successfully.`, 'success');
                fetchOrders();
                console.log(`handleCancelOrder: Order ${orderId} cancelled.`);
            } else {
                const errorData = await response.json();
                showAlert(`Failed to cancel order ${orderId}: ${errorData.error || errorData.message}`, 'error');
                console.error(`handleCancelOrder: Failed to cancel order ${orderId}:`, errorData);
            }
        } catch (error) {
            console.error('handleCancelOrder: Error cancelling order:', error);
            showAlert('An error occurred while cancelling the order.', 'error');
        }
    }


    // --- Chatbot Overlay Logic ---
    chatbotBubbleBtn.addEventListener('click', () => {
        console.log("Chatbot bubble clicked. Toggling overlay visibility.");
        chatbotOverlayDiv.classList.toggle('hidden'); // Toggle visibility
        if (!chatbotOverlayDiv.classList.contains('hidden')) {
            chatInput.focus(); // Focus input when opened
        }
    });

    chatbotCloseBtn.addEventListener('click', () => {
        console.log("Chatbot close button clicked. Hiding overlay.");
        chatbotOverlayDiv.classList.add('hidden'); // Hide the overlay
    });


    // --- Chatbot Core Logic (Integrated) ---
    function appendChatMessage(text, sender) {
        const messageWrapper = document.createElement('div');
        const messageBubble = document.createElement('div');

        if (sender === 'user') {
            messageWrapper.classList.add('justify-end');
            messageBubble.classList.add('user-message-bubble');
        } else { // sender === 'ai'
            messageWrapper.classList.add('justify-start');
            messageBubble.classList.add('ai-message-bubble');
        }

        messageWrapper.classList.add('message-wrapper');
        messageBubble.textContent = text;

        chatMessagesDiv.appendChild(messageWrapper);
        messageWrapper.appendChild(messageBubble); // Append bubble to wrapper

        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }

    chatSendButton.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    async function sendChatMessage() {
        const query = chatInput.value.trim();
        if (query === '') return;

        appendChatMessage(query, 'user');
        chatInput.value = '';

        try {
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            if (data.reply) {
                appendChatMessage(data.reply, 'ai');
            } else if (data.error) {
                appendChatMessage(`Error: ${data.error}`, 'ai');
            }
        } catch (error) {
            console.error('Error sending chat message:', error);
            appendChatMessage('An error occurred while connecting to the chat service.', 'ai');
        }
    }


    // --- Initial Page Load Logic ---
    document.addEventListener('DOMContentLoaded', () => {
        console.log("ecom.js: DOMContentLoaded - Initializing UI.");
        // Ensure chatbot overlay is hidden immediately on load
        chatbotOverlayDiv.classList.add('hidden'); // Explicitly hide on load

        fetchUserInfo(); // Check login status and update UI, which then calls showSection and fetchProducts/Auth
        updateAuthFormUI(); // Set initial auth form state (login mode)
        updateCartCount(); // Get initial cart count
    });