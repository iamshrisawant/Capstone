// prototyping/public/main.js
document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.getElementById('chat-container');

    // The URL for your Node.js backend server
    // This should match the PORT defined in prototyping/backend/server.js
    const backendUrl = 'http://localhost:3000';

    /**
     * Appends a new message to the chat container.
     * @param {string} text The text content of the message.
     * @param {string} sender 'user' or 'ai' to apply appropriate styling.
     */
    function appendMessage(text, sender) {
        const messageWrapper = document.createElement('div');
        const messageDiv = document.createElement('div');

        // Apply flex justification based on sender
        if (sender === 'user') {
            messageWrapper.classList.add('flex', 'justify-end');
            messageDiv.classList.add('bg-blue-500', 'text-white', 'rounded-xl', 'rounded-br-none');
        } else { // sender === 'ai'
            messageWrapper.classList.add('flex', 'justify-start');
            messageDiv.classList.add('bg-gray-200', 'text-gray-800', 'rounded-xl', 'rounded-bl-none');
        }

        messageDiv.classList.add('p-3', 'shadow-sm', 'max-w-[75%]');
        messageDiv.textContent = text;

        messageWrapper.appendChild(messageDiv);
        chatContainer.appendChild(messageWrapper);

        // Scroll to the bottom of the chat container to show the latest message
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /**
     * Sends the user's message to the backend and displays the AI's response.
     */
    async function sendMessage() {
        const query = userInput.value.trim();
        if (query === '') return; // Don't send empty messages

        // Display user's message immediately
        appendMessage(query, 'user');
        userInput.value = ''; // Clear the input field

        try {
            // Make a POST request to the backend's /chat endpoint
            const response = await fetch(`${backendUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query }) // Send the user's query as JSON
            });

            // Check if the response was successful
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Something went wrong on the server.');
            }

            const data = await response.json();
            if (data.reply) {
                appendMessage(data.reply, 'ai'); // Display AI's reply
            } else {
                // Fallback for unexpected successful response structure
                appendMessage('Received an unexpected response from the AI.', 'ai');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            appendMessage(`An error occurred: ${error.message}. Please try again.`, 'ai');
        }
    }

    // Event listeners for sending messages
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Focus on the input field when the page loads
    userInput.focus();
});
