// auth.js - Handles Firebase Authentication and primary redirection logic

document.addEventListener('DOMContentLoaded', () => {
    console.log("auth.js: DOMContentLoaded.");

    // --- Firebase Initialization Check ---
    if (!firebase || typeof firebase.auth !== 'function') {
        console.error("auth.js: Firebase Auth is not initialized or not a function. Ensure firebase-app.js and firebase-auth.js are loaded and firebase.initializeApp() has been called with a VALID config in the HTML before this script.");
        const authMessagesEl = document.getElementById('authMessages');
        if (authMessagesEl) {
            authMessagesEl.textContent = 'Application critical error: Authentication service failed to load. Check Firebase configuration.';
            authMessagesEl.className = 'message-area error-message visible';
        }
        // Hide any loading overlays if auth fails critically
        const loginLoadingOverlay = document.getElementById('authLoadingOverlay');
        if (loginLoadingOverlay) loginLoadingOverlay.style.display = 'none';
        const dashboardLoadingOverlay = document.getElementById('loadingOverlay');
        if (dashboardLoadingOverlay) dashboardLoadingOverlay.classList.remove('show');
        return;
    }

    const auth = firebase.auth();
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    console.log(`auth.js: Current page is ${currentPage}`);

    // --- Login Page Elements (login.html) ---
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailPasswordSignInButton = document.getElementById('emailPasswordSignInButton');
    const emailPasswordSignUpButton = document.getElementById('emailPasswordSignUpButton');
    const googleSignInButton = document.getElementById('googleSignInButton');
    const authMessages = document.getElementById('authMessages'); // For login/signup messages
    const toggleFormButton = document.getElementById('toggleFormButton');
    const toggleMessage = document.getElementById('toggleMessage');
    const authFormTitle = document.getElementById('authFormTitle');
    const authLoadingOverlay = document.getElementById('authLoadingOverlay'); // Specific to login page actions
    // Get the auth container element on the login page
    const authContainer = document.querySelector('.auth-container');
    // Add a log to check if authContainer is found
    console.log(`auth.js on ${currentPage}: authContainer element found:`, !!authContainer);


    // --- Shared Header Elements (index.html, dashboard.html) ---
    const loginSignupButton = document.getElementById('loginSignupButton');
    const dashboardButton = document.getElementById('dashboardButton');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const logoutButton = document.getElementById('logoutButton'); // Universal logout button

    // --- Dashboard specific elements (to hide/show loading) ---
    const dashboardLoadingGlobalOverlay = document.getElementById('loadingOverlay'); // From dashboard.html

    let isLoginMode = true; // For login.html form toggle

    function showAuthProcessLoading(isLoading) {
        if (authLoadingOverlay) {
            authLoadingOverlay.style.display = isLoading ? 'flex' : 'none';
        }
        if (emailPasswordSignInButton) emailPasswordSignInButton.disabled = isLoading;
        if (emailPasswordSignUpButton) emailPasswordSignUpButton.disabled = isLoading;
        if (googleSignInButton) googleSignInButton.disabled = isLoading;
    }

    function showAuthMessage(message, type = 'error') {
        if (authMessages) {
            authMessages.textContent = message;
            authMessages.className = `message-area ${type}-message visible`;
        }
    }

    function clearAuthMessage() {
        if (authMessages) {
            authMessages.textContent = '';
            authMessages.className = 'message-area';
        }
    }

    function toggleAuthModeUI() {
        if (currentPage !== 'login.html') return; // Only for login page
        clearAuthMessage();
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';

        if (isLoginMode) {
            if (authFormTitle) authFormTitle.textContent = 'Login to Your Account';
            if (emailPasswordSignInButton) emailPasswordSignInButton.style.display = 'flex';
            if (emailPasswordSignUpButton) emailPasswordSignUpButton.style.display = 'none';
            if (toggleMessage) toggleMessage.textContent = "Don't have an account?";
            if (toggleFormButton) toggleFormButton.textContent = 'Sign Up';
        } else {
            if (authFormTitle) authFormTitle.textContent = 'Create a New Account';
            if (emailPasswordSignInButton) emailPasswordSignInButton.style.display = 'none';
            if (emailPasswordSignUpButton) emailPasswordSignUpButton.style.display = 'flex';
            if (toggleMessage) toggleMessage.textContent = 'Already have an account?';
            if (toggleFormButton) toggleFormButton.textContent = 'Login';
        }
    }

    // --- Event Listeners for login.html ---
    if (currentPage === 'login.html') {
        // Initialize UI state, but don't show the container yet
        toggleAuthModeUI();

        if (toggleFormButton) {
            toggleFormButton.addEventListener('click', () => {
                isLoginMode = !isLoginMode;
                toggleAuthModeUI();
            });
        }

        if (emailPasswordSignUpButton) {
            emailPasswordSignUpButton.addEventListener('click', async () => {
                clearAuthMessage();
                if (!emailInput || !passwordInput) { showAuthMessage('Internal error: Input fields missing.'); return; }
                const email = emailInput.value.trim();
                const password = passwordInput.value;
                if (!email || !password) { showAuthMessage('Please enter both email and password.'); return; }
                if (password.length < 6) { showAuthMessage('Password should be at least 6 characters.'); return; }

                showAuthProcessLoading(true);
                try {
                    console.log("auth.js: Attempting email/password sign up for:", email);
                    await auth.createUserWithEmailAndPassword(email, password);
                    // onAuthStateChanged will handle redirection
                    console.log("auth.js: Sign up successful for:", email);
                } catch (error) {
                    console.error("auth.js: Sign Up Error:", error);
                    showAuthMessage(error.message || "Sign up failed. Please try again.");
                } finally {
                    showAuthProcessLoading(false);
                }
            });
        }

        if (emailPasswordSignInButton) {
            emailPasswordSignInButton.addEventListener('click', async () => {
                clearAuthMessage();
                if (!emailInput || !passwordInput) { showAuthMessage('Internal error: Input fields missing.'); return; }
                const email = emailInput.value.trim();
                const password = passwordInput.value;
                if (!email || !password) { showAuthMessage('Please enter both email and password.'); return; }

                showAuthProcessLoading(true);
                try {
                    console.log("auth.js: Attempting email/password sign in for:", email);
                    await auth.signInWithEmailAndPassword(email, password);
                    // onAuthStateChanged will handle redirection
                    console.log("auth.js: Sign in successful for:", email);
                } catch (error) {
                    console.error("auth.js: Sign In Error:", error);
                    showAuthMessage(error.message || "Sign in failed. Please check your credentials.");
                } finally {
                    showAuthProcessLoading(false);
                }
            });
        }

        if (googleSignInButton) {
            googleSignInButton.addEventListener('click', async () => {
                clearAuthMessage();
                const provider = new firebase.auth.GoogleAuthProvider();
                showAuthProcessLoading(true);
                try {
                    console.log("auth.js: Attempting Google sign in.");
                    await auth.signInWithPopup(provider);
                    // onAuthStateChanged will handle redirection
                    console.log("auth.js: Google sign in successful.");
                } catch (error) {
                    console.error("auth.js: Google Sign-In Error:", error);
                    showAuthMessage(error.message || "Google Sign-In failed. Please try again.");
                } finally {
                    showAuthProcessLoading(false);
                }
            });
        }
    }

    // --- Universal Logout Button Functionality ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log("auth.js: Logout button clicked.");
            try {
                await auth.signOut();
                console.log('auth.js: User signed out successfully via logout button.');
                // onAuthStateChanged will handle UI updates and redirect to login.html
                // No explicit redirect here to avoid conflicts.
            } catch (error) {
                console.error('auth.js: Logout error:', error);
                // Show error on the current page if possible
                if (currentPage === 'dashboard.html' && typeof updateDashboardStatus === 'function') {
                    updateDashboardStatus('Error signing out: ' + error.message, 'error');
                } else {
                    alert('Error signing out: ' + error.message);
                }
            }
        });
    }

    // --- Firebase Auth State Observer ---
    // This is the primary controller for auth-based redirection and UI updates.
    // let authStateProcessed = false; // Flag removed

    auth.onAuthStateChanged(user => {
        console.log(`auth.js: Auth state changed. User: ${user ? user.email : 'null'}. Current Page: ${currentPage}.`);

        // Update shared header UI elements based on auth state
        if (user) {
            if (userEmailDisplay) {
                userEmailDisplay.textContent = user.email || user.displayName || 'User';
                userEmailDisplay.style.display = 'inline-block';
            }
            if (dashboardButton) dashboardButton.style.display = 'inline-block';
            if (logoutButton) logoutButton.style.display = 'inline-flex'; // Use inline-flex if it's a flex item
            if (loginSignupButton) loginSignupButton.style.display = 'none';
        } else {
            // User is signed out
            if (userEmailDisplay) userEmailDisplay.style.display = 'none';
            if (dashboardButton) dashboardButton.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'none';
            // Show the login/signup button in the header when logged out
            if (loginSignupButton) loginSignupButton.style.display = 'inline-block';
        }

        // Redirection Logic
        if (user) {
            // ----- USER IS SIGNED IN -----
            if (currentPage === 'login.html') {
                console.log('auth.js: User signed in, on login page. Redirecting to dashboard.html');
                window.location.href = 'dashboard.html';
            } else {
                // User is on a page other than login (e.g., dashboard.html, index.html)
                // If on dashboard, hide its global loading overlay as auth is confirmed.
                if (currentPage === 'dashboard.html' && dashboardLoadingGlobalOverlay) {
                    console.log("auth.js: User signed in on dashboard, ensuring global loading overlay is hidden.");
                    dashboardLoadingGlobalOverlay.classList.remove('show');
                    // dashboard.js will handle showing main content.
                }
                // No redirection needed for signed-in users on other pages
            }
        } else {
            // ----- USER IS SIGNED OUT -----
            // Removed index.html from protected pages to allow public access
            const protectedPages = ['dashboard.html', 'editor.html','result.html', 'compare.html']; // Add any other pages that *require* login

            if (protectedPages.includes(currentPage)) {
                console.log(`auth.js: User not signed in, on protected page (${currentPage}). Redirecting to login.html`);
                window.location.href = 'login.html';
            } else if (currentPage === 'login.html') {
                // User is on the login page and signed out. This is the correct state.
                console.log("auth.js: User not signed in, on login page. Correct state. Ensuring UI is login mode and showing popup.");
                isLoginMode = true;
                toggleAuthModeUI(); // Ensure login form UI is correct

                // --- Show the auth container on login.html if user is not signed in ---
                if (authContainer) {
                    authContainer.classList.add('visible'); // Add 'visible' class to show it
                    console.log("auth.js: Added 'visible' class to authContainer.");
                } else {
                    console.error("auth.js: auth-container not found on login.html, cannot show popup.");
                }
                // --- END SHOW POPUP ---

                // Hide any global loading overlays if visible
                if (dashboardLoadingGlobalOverlay) dashboardLoadingGlobalOverlay.classList.remove('show');
                if (authLoadingOverlay) authLoadingOverlay.style.display = 'none';
            } else {
                 // User is signed out and on a non-protected page (like index.html).
                 // No redirection needed. The header will show the Login/Sign Up button.
                 console.log(`auth.js: User not signed in, on public page (${currentPage}). No redirection.`);
            }
        }
    });

    console.log("auth.js: Script loaded and event listeners (potentially) attached.");
});
