// prototyping/neo4j/seed_data.cypher

// --- User Schema and Constraints ---
// Create a uniqueness constraint on the User email property.
// This is crucial for authentication to ensure each user has a unique email.
CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE;

// Create an index on the User id property for faster lookups.
CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id);

// Example Users (for initial testing, passwords are NOT hashed here, they will be hashed by authService)
// In a real scenario, you would register users via the API, not seed them with plain passwords.
// These are just placeholders to illustrate the structure.
// DO NOT use plain passwords in production seed data.
CREATE (:User {id: 'user_john_doe', email: 'john.doe@example.com', passwordHash: 'hashed_password_john', name: 'John Doe', createdAt: '2025-07-31T08:00:00Z'});
CREATE (:User {id: 'user_jane_smith', email: 'jane.smith@example.com', passwordHash: 'hashed_password_jane', name: 'Jane Smith', createdAt: '2025-07-31T08:01:00Z'});


// --- Existing Customer and Order Data (adjusted to be consistent with new User concept if desired) ---
// If you want to link existing Orders to new Users, you'd adjust these.
// For now, keeping them separate from new :User nodes to avoid breaking existing chatbot logic.
// Later, we can decide if :Customer should be merged with :User or linked.

// Original Customers (kept for existing chatbot queries)
CREATE (:Customer {id: 'C001', name: 'John Doe'});
CREATE (:Customer {id: 'C002', name: 'Jane Smith'});
CREATE (:Customer {id: 'C003', name: 'Alice Wonderland'});

// Original Orders and relationships (kept for existing chatbot queries)
CREATE (:Order {id: '10234', status: 'Shipped', eta: '2025-08-02', item: 'Laptop'})-[:PLACED_BY]->(:Customer {id: 'C001'});
CREATE (:Order {id: '10235', status: 'Processing', eta: '2025-08-05', item: 'Smartphone'})-[:PLACED_BY]->(:Customer {id: 'C002'});
CREATE (:Order {id: '10236', status: 'Delivered', eta: '2025-07-28', item: 'Headphones'})-[:PLACED_BY]->(:Customer {id: 'C001'});
CREATE (:Order {id: '10237', status: 'Shipped', eta: '2025-08-03', item: 'Smartwatch'})-[:PLACED_BY]->(:Customer {id: 'C003'});

// Example: Link a new User to an Order (optional, for future integration)
// CREATE (:User {id: 'user_new', email: 'new@example.com', passwordHash: 'hashed_new', name: 'New User'})
// -[:PLACED]->(:Order {id: 'NEWORDER001', status: 'Pending', eta: '2025-08-10', item: 'Gaming Chair'});
