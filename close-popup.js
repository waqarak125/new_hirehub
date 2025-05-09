// close-popup.js

document.addEventListener('DOMContentLoaded', function() {
    // Get the close button and the auth container
    const closeButton = document.querySelector('.close-button');
    const authContainer = document.querySelector('.auth-container');

    // Add a click event listener to the close button
    if (closeButton && authContainer) {
        closeButton.addEventListener('click', function() {
            // Hide the auth container by adding a 'hidden' class
            authContainer.classList.add('hidden');
        });
    } else {
        console.error("Close button or auth container not found.");
    }
});
