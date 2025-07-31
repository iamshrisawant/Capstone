// prototyping/backend/authService.js
const neo4jClient = require('./neo4j'); // Import the Neo4j client
const bcrypt = require('bcryptjs'); // Import bcryptjs for password hashing
const crypto = require('crypto'); // Node.js built-in for UUID generation

/**
 * Registers a new user by creating a :User node in Neo4j with a hashed password.
 * @param {string} email User's email (must be unique).
 * @param {string} password User's plain-text password.
 * @param {string} name User's display name.
 * @returns {Promise<object>} An object containing user's generated ID, email, and name.
 * @throws {Error} If registration fails (e.g., email already exists, database error).
 */
async function registerUser(email, password, name) {
  try {
    // 1. Hash the password
    const saltRounds = 10; // Cost factor for hashing (higher = more secure, slower)
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 2. Generate a unique ID for the new user
    const userId = `user_${crypto.randomUUID()}`; // Prefix for clarity

    // 3. Create the :User node in Neo4j
    const query = `
      CREATE (u:User {
        id: $userId,
        email: $email,
        passwordHash: $passwordHash,
        name: $name,
        createdAt: datetime()
      })
      RETURN u.id AS id, u.email AS email, u.name AS name
    `;
    const params = { userId, email, passwordHash, name };

    const result = await neo4jClient.executeCypher(query, params);

    if (result.length === 0) {
      throw new Error("User registration failed: No user node created.");
    }

    console.log(`User registered and data saved to Neo4j: ${userId}`);
    return result[0]; // Return the created user's data
  } catch (error) {
    // Check for unique constraint violation (email already exists)
    if (error.message.includes('already exists with label `User` and property `email`')) {
        throw new Error('Registration failed: An account with this email already exists.');
    }
    console.error("Error registering user:", error.message);
    throw new Error(`Registration failed: ${error.message}`);
  }
}

/**
 * Logs in an existing user by verifying credentials against Neo4j.
 * @param {string} email User's email.
 * @param {string} password User's plain-text password.
 * @returns {Promise<object>} An object containing user's ID, email, and name if login is successful.
 * @throws {Error} If login fails (e.g., invalid credentials).
 */
async function loginUser(email, password) {
  try {
    // 1. Find the user by email in Neo4j
    const query = `
      MATCH (u:User {email: $email})
      RETURN u.id AS id, u.email AS email, u.passwordHash AS passwordHash, u.name AS name
    `;
    const params = { email };
    const result = await neo4jClient.executeCypher(query, params);

    if (result.length === 0) {
      throw new Error('Login failed: Invalid email or password.');
    }

    const user = result[0];
    const storedPasswordHash = user.passwordHash;

    // 2. Compare the provided password with the stored hash
    const passwordMatch = await bcrypt.compare(password, storedPasswordHash);

    if (!passwordMatch) {
      throw new Error('Login failed: Invalid email or password.');
    }

    console.log(`User logged in: ${user.id}`);
    return { uid: user.id, email: user.email, name: user.name }; // Return user data
  } catch (error) {
    console.error("Error logging in user:", error.message);
    throw new Error(`Login failed: ${error.message}`);
  }
}

/**
 * Logs out the current user (no direct Neo4j action needed for logout,
 * as session management is handled by express-session).
 * This function is kept for consistency but does nothing specific to Neo4j.
 * @returns {Promise<void>}
 */
async function logoutUser() {
  console.log("User logout initiated (session will be destroyed by Express).");
  // No direct Neo4j operation for logout.
  return Promise.resolve();
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser
};
