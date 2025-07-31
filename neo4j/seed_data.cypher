// === Customers ===
CREATE (:Customer {id: 'C001', name: 'John Doe', email: 'john@example.com', phone: '9876543210'});
CREATE (:Customer {id: 'C002', name: 'Priya Singh', email: 'priya@example.com', phone: '9123456780'});

// === Products ===
CREATE (:Product {id: 'P1001', name: 'Smartphone X', description: '64GB, Black', price: 599.99, stock: 12, category: 'Electronics'});
CREATE (:Product {id: 'P1002', name: 'Wireless Headphones', description: 'Noise Cancelling', price: 199.99, stock: 30, category: 'Accessories'});

// === Orders ===
CREATE (:Order {id: 'O9001', status: 'Shipped', eta: '2025-08-02', date: '2025-07-25', quantity: 1, total: 599.99});
CREATE (:Order {id: 'O9002', status: 'Out for delivery', eta: '2025-08-01', date: '2025-07-26', quantity: 2, total: 399.98});

// === Relationships ===
MATCH (o:Order {id: 'O9001'}), (c:Customer {id: 'C001'}), (p:Product {id: 'P1001'})
CREATE (o)-[:PLACED_BY]->(c),
       (o)-[:CONTAINS]->(p);

MATCH (o:Order {id: 'O9002'}), (c:Customer {id: 'C002'}), (p:Product {id: 'P1002'})
CREATE (o)-[:PLACED_BY]->(c),
       (o)-[:CONTAINS]->(p);
