// prototyping/agent_console/console.js
document.addEventListener('DOMContentLoaded', async () => {
    const fallbackList = document.getElementById('fallback-list');
    // The URL for your Node.js backend server (same as for the chat frontend)
    const backendUrl = 'http://localhost:3000';

    /**
     * Fetches fallback entries from the backend and displays them.
     */
    async function fetchAndDisplayFallbacks() {
        fallbackList.innerHTML = '<p class="text-center text-gray-600">Loading fallback requests...</p>'; // Clear and show loading
        try {
            const response = await fetch(`${backendUrl}/fallbacks`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch fallback entries from server.');
            }
            const fallbacks = await response.json();

            fallbackList.innerHTML = ''; // Clear loading message

            if (fallbacks.length === 0) {
                fallbackList.innerHTML = '<p class="text-center text-gray-600">No fallback requests found.</p>';
                return;
            }

            // Sort fallbacks by timestamp, newest first
            fallbacks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            fallbacks.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('fallback-item', 'mb-4', 'p-4', 'rounded-lg', 'shadow');

                // Add status class based on whether humanReply exists
                if (item.humanReply) {
                    itemDiv.classList.add('status-resolved', 'border-green-400');
                } else {
                    itemDiv.classList.add('status-pending', 'border-red-500');
                }

                itemDiv.innerHTML = `
                    <p class="font-semibold text-lg text-gray-800">User Query: <span class="font-normal">${item.userQuery}</span></p>
                    <p class="text-gray-700"><strong>LLM Plan:</strong> ${JSON.stringify(item.llmPlan, null, 2)}</p>
                    <p class="text-gray-700"><strong>LLM Reply:</strong> ${item.llmReply}</p>
                    <p class="text-gray-600 text-sm"><strong>Timestamp:</strong> ${new Date(item.timestamp).toLocaleString()}</p>
                    ${item.humanReply ? `
                        <p class="text-green-700 mt-2"><strong>Human Reply:</strong> ${item.humanReply}</p>
                        <p class="text-sm text-gray-500 mt-1">Status: Resolved</p>
                    ` : `
                        <textarea id="human-reply-${item.timestamp}" placeholder="Enter human correction/response here..."
                                  class="mt-3 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2"></textarea>
                        <button data-timestamp="${item.timestamp}"
                                class="save-button mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                            Save Human Reply
                        </button>
                        <p class="text-sm text-red-500 mt-1">Status: Pending</p>
                    `}
                `;
                fallbackList.appendChild(itemDiv);
            });

            // Add event listeners for save buttons
            document.querySelectorAll('.save-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const timestamp = event.target.dataset.timestamp;
                    const textarea = document.getElementById(`human-reply-${timestamp}`);
                    const humanReply = textarea.value.trim();

                    if (humanReply) {
                        try {
                            const response = await fetch(`${backendUrl}/fallbacks/update`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ timestamp, humanReply })
                            });
                            const result = await response.json();
                            if (response.ok) {
                                // Use a simple alert for now, consider a custom modal for production
                                alert(result.message);
                                fetchAndDisplayFallbacks(); // Refresh the list to show updated status
                            } else {
                                alert(`Error: ${result.error}`);
                            }
                        } catch (error) {
                            console.error("Error saving human reply:", error);
                            alert("Failed to save human reply. Please check console for details.");
                        }
                    } else {
                        alert("Please enter a human reply before saving.");
                    }
                });
            });

        } catch (error) {
            console.error('Error fetching fallback entries:', error);
            fallbackList.innerHTML = `<p class="text-center text-red-500">Failed to load fallback requests: ${error.message}</p>`;
        }
    }

    // Initial fetch and display when the page loads
    fetchAndDisplayFallbacks();
});
