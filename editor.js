// This script should be linked in index.html using <script src="editor.js" defer></script>

// --- Firebase Configuration (ensure it's defined globally in the HTML <head>) ---
// The firebaseConfig object is expected to be defined globally in the HTML <head>
// For example:
// const firebaseConfig = {
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_AUTH_DOMAIN",
//     databaseURL: "YOUR_DATABASE_URL",
//     projectId: "YOUR_PROJECT_ID",
//     storageBucket: "YOUR_STORAGE_BUCKET",
//     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//     appId: "YOUR_APP_ID",
// };

// Declare databaseURL variable and initialize it from the global firebaseConfig
// Ensure firebaseConfig is accessible here. It is defined in the <script> tag in index.html head.
let databaseURL;
if (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL) {
    databaseURL = firebaseConfig.databaseURL;
} else {
    console.error("firebaseConfig or databaseURL is not defined globally before editor.js runs.");
    // Handle this error appropriately, e.g., disable save button
}


// Initialize Firebase App
// This must be done after firebaseConfig is defined.
// It's good practice to do this at the start of your main JS file if config is global.
if (!firebase.apps.length) {
    try {
         // Check if firebaseConfig is defined before initializing
         if (typeof firebaseConfig !== 'undefined') {
             firebase.initializeApp(firebaseConfig);
             console.log("Firebase App initialized successfully from editor.js.");
         } else {
             throw new Error("firebaseConfig is not defined.");
         }
    } catch (error) {
         console.error("Error initializing Firebase App from editor.js:", error);
         // Find the publishStatusDiv even if it's not immediately available (using DOMContentLoaded)
         document.addEventListener('DOMContentLoaded', () => {
             const publishStatusDiv = document.getElementById("publishStatus");
             if (publishStatusDiv) { // Check if element exists
                publishStatusDiv.style.display = 'block';
                publishStatusDiv.className = 'error-message';
                publishStatusDiv.innerHTML = `Error initializing Firebase App: ${error.message}. Please check your firebaseConfig and the browser console for details.`;
             }
             const savePublishButton = document.getElementById("savePublishButton");
             if (savePublishButton) { // Check if element exists
                savePublishButton.disabled = true;
             }
         });
    }
} else {
    firebase.app(); // if already initialized, use that app
     console.log("Firebase App already initialized (checked from editor.js).");
}


// --- Webhook Function (runs early, can be called later) ---
// Accept dataToSend object and necessary UI update functions as arguments
function sendDataToWebhook(dataToSend, questionsContainer, questionsTitleElement, addQuestionToDataAndUI, updateFormPreview) {
    // --- Configuration ---
    // IMPORTANT: Replace this placeholder URL with your actual n8n webhook URL
    const webhookUrl = "https://waqarwork125.app.n8n.cloud/webhook/3efb8c6a-8588-4f5a-ba97-183a3a824f17"; // User's Webhook
    const aiQuestionContent = document.getElementById("aiQuestionContent");
    const aiQuestionBlock = document.getElementById("aiQuestionBlock");
    const questionListDiv = document.getElementById("questionList"); // Get the question list div
    const formPreviewDiv = document.getElementById("formPreview"); // Get the form preview div


    // --- Validation ---
    if (!webhookUrl || webhookUrl.startsWith("YOUR_WEBHOOK_URL") || webhookUrl.length < 20) { // Basic check
        console.error("Webhook URL is not configured correctly. Please update the webhookUrl variable in the script.");
        // Display an error message to the user within the AI block
        if (aiQuestionContent && aiQuestionBlock) { // Check if elements exist
            aiQuestionContent.innerHTML = `<p class="error-message">AI Service Error: Webhook endpoint is not configured.</p>`;
            aiQuestionBlock.style.display = 'block'; // Ensure block is visible
        }
        return; // Stop execution
    }

    // --- UI Update: Show Loading ---
    if (aiQuestionContent && aiQuestionBlock) { // Check if elements exist
        aiQuestionContent.innerHTML = `<p class="loading-message">🧠 Thinking... Fetching AI suggestions...👋</p>`;
        aiQuestionBlock.style.display = 'block'; // Make sure the block is visible
    }

    // Clear existing questions and hide sections while loading
    if (questionsContainer) questionsContainer.innerHTML = "";
    formQuestions = []; // Clear the formQuestions array
    if (questionListDiv) questionListDiv.classList.add('hidden');
    if (formPreviewDiv) formPreviewDiv.classList.add('hidden');


    console.log("Sending data to webhook:", dataToSend);

    // --- API Call ---
    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Add any other required headers here (e.g., API keys if needed)
        },
        body: JSON.stringify(dataToSend)
    })
    .then(response => {
        // --- Handle HTTP Errors ---
        if (!response.ok) {
            // Try to get more error details from the response body
            return response.text().then(text => {
                console.error(`Webhook HTTP error! Status: ${response.status}, Body: ${text}`);
                // Throw an error that includes status and potentially body text
                throw new Error(`AI Service Error: Request failed with status ${response.status}.`);
            });
        }
        // --- Parse JSON Response ---
        return response.json();
    })
    .then(responseData => {
        console.log('Data received successfully from webhook:', responseData);

        // --- Process Valid Response ---
        // Access data via responseData[0].output based on the provided debugger output
        if (
            Array.isArray(responseData) &&
            responseData.length > 0 &&
            responseData[0].output && // Corrected access path
            Array.isArray(responseData[0].output)
        ) {
            const aiQuestions = responseData[0].output; // Corrected access path

            if (aiQuestionContent) aiQuestionContent.innerHTML = ""; // Clear loading message/previous AI suggestions display

            if (aiQuestions.length === 0) {
                if (aiQuestionContent) aiQuestionContent.innerHTML = `<p>AI didn't suggest any questions based on the instructions.</p>`;
            } else {
                // --- Map AI Answer Type strings to internal types ---
                const answerTypeMap = {
                    "Text Input": "text",
                    "Number Input": "number",
                    "Text Area": "textarea",
                    "Dropdown": "dropdown",
                    "Multiple Choice": "multiple_choice",
                    "Checkboxes": "checkboxes",
                    "Yes/No": "yes_no",
                    "Rating": "rating",
                    "File Upload": "file" // Added mapping for File Upload
                };

                // --- Add AI questions to data and UI ---
                aiQuestions.forEach((item) => {
                    // Validate the structure of each suggested question item
                    if (item && typeof item["Question Statement"] === 'string' && typeof item["Answer Type"] === 'string') {
                        const questionText = item["Question Statement"];
                        const aiAnswerType = item["Answer Type"];
                        const internalType = answerTypeMap[aiAnswerType] || "text"; // Default to text if type is unknown

                        let options = [];
                        if (["dropdown", "multiple_choice", "checkboxes"].includes(internalType)) {
                             options = [""]; // Add a default empty option
                        }
                        // Ensure addQuestionToDataAndUI and updateFormPreview are passed and callable
                        // Use the functions passed as arguments
                        if (typeof addQuestionToDataAndUI === 'function') {
                             addQuestionToDataAndUI(questionText, internalType, options, true); // Pass true for isAISuggested
                        } else {
                             console.error("addQuestionToDataAndUI function is not available (inside webhook success).");
                         }


                    } else {
                        console.warn("Received invalid AI question item structure:", item);
                        if (typeof addQuestionToDataAndUI === 'function') {
                             addQuestionToDataAndUI(`[Invalid AI Question Format]`, "text", [], true); // Pass true for isAISuggested
                        } else {
                             console.error("addQuestionToDataAndUI function is not available (inside webhook success, invalid item).");
                         }
                    }
                });

                // Ensure updateFormPreview is passed and callable
                // Use the function passed as an argument
                if (typeof updateFormPreview === 'function') {
                     updateFormPreview(); // Update preview AFTER adding all questions
                } else {
                     console.error("updateFormPreview function is not available (inside webhook success).");
                 }

                if (aiQuestionContent) aiQuestionContent.innerHTML = `<p class="success-message">AI suggestions added to the builder below.</p>`;

                 // Show question list and preview after AI suggestions are loaded
                 if (questionListDiv) questionListDiv.classList.remove('hidden');
                 if (formPreviewDiv) formPreviewDiv.classList.remove('hidden');
            }
            if (aiQuestionBlock) aiQuestionBlock.style.display = 'block'; // Ensure block is visible
        } else {
            console.error("Received unexpected data structure from webhook:", responseData);
            if (aiQuestionContent && aiQuestionBlock) { // Check if elements exist
                aiQuestionContent.innerHTML = `<p class="error-message">AI Service Error: Could not process the response. Unexpected format.</p>`;
                aiQuestionBlock.style.display = 'block';
            }
        }
    })
    .catch(error => {
        console.error('Error sending/processing data from webhook:', error);
        if (aiQuestionContent && aiQuestionBlock) { // Check if elements exist
            aiQuestionContent.innerHTML = `<p class="error-message">${error.message || 'An unknown error occurred while fetching AI suggestions.'}</p>`;
            aiQuestionBlock.style.display = 'block';
        }
    });
}


// --- Run Code After DOM is Loaded ---
document.addEventListener('DOMContentLoaded', () => {

    console.log("editor.js: DOMContentLoaded.");

    // --- Get DOM Element References ---
    const heroSection = document.getElementById("heroSection"); // New: Hero section
    const getStartedButton = document.getElementById("getStartedButton"); // Get the Get Started button
    const editorContainer = document.getElementById("editorContainer"); // New: Main editor container
    const aiInstructionsBlock = document.getElementById("aiInstructionsBlock"); // Get the AI block for scrolling - Not in provided HTML
    const questionsContainer = document.getElementById("questionsContainer");
    const formPreviewDiv = document.getElementById("formPreview"); // Renamed for clarity
    // const formPreviewContentDiv = document.getElementById("formPreviewContent"); // New div for preview content - Not in provided HTML, using formPreviewDiv directly
    const questionsTitleElement = document.getElementById("questionsTitle");
    const instructionBox = document.getElementById("instructions");
    const useCaseSelect = document.getElementById("useCaseSelect"); // Keep for now, could be integrated later - Not in provided HTML
    const formNameInput = document.getElementById("formNameInput"); // Target for scrolling
    const addManualQuestionButton = document.getElementById("addManualQuestionButton");
    const getAIFormButton = document.getElementById("sendInstructionsButton"); // Corrected ID to match HTML
    const savePublishButton = document.getElementById("savePublishButton");
    const publishStatusDiv = document.getElementById("publishStatus");
    const questionListDiv = document.getElementById("questionList"); // Get the question list div
    // const formBuilderArea = document.querySelector(".form-builder"); // Corrected selector to match HTML - Using formNameInput's parent for scroll target


    // Define the desired scroll offset (in pixels)
    const scrollOffset = 100; // Adjust this value as needed


    // Priority-Based Elements
    const openPriorityModalButton = document.getElementById("openPrioritiesModalButton"); // Corrected ID to match HTML

    // Priority Modal Elements
    const priorityModal = document.getElementById("aiPrioritiesModal"); // CORRECTED ID HERE
    const modalPriorityInputsDiv = document.getElementById("modalPriorityInputs"); // Container for dynamic inputs
    const modalTotalWeightSpan = document.getElementById("modalCurrentTotal"); // Display for total weight
    const modalWeightErrorDiv = document.getElementById("modalWeightError"); // Error message for weight
    const savePrioritiesButton = document.getElementById("savePrioritiesButton");
    const modalPrioritiesToggle = document.getElementById("priorityToggleSwitch"); // Corrected ID to match HTML
    const closePrioritiesModalButton = document.getElementById("closePrioritiesModalButton"); // Close button for the modal


    // General Modal elements (for signup/login) - These are likely handled by auth.js or another script
    // Removed duplicate declarations causing SyntaxError
    // const signupButton = document.getElementById("signupButton");
    // const loginButton = document.getElementById("loginButton");
    // const signupModal = document.getElementById("signupModal");
    // const loginModal = document.getElementById("loginModal");
    // const closeButtons = document.querySelectorAll(".modal-overlay .close-button"); // Select all close buttons - handled by delegation


    // --- Pre-defined Question Templates (Can still be used, or priorities can override) ---
    // Keeping this for potential manual template loading, though AI is primary now.
    const questionTemplates = {
        job: [
            { text: "Full Name", type: "text" },
            { text: "Email Address", type: "text" },
            { text: "Phone Number", type: "text" },
            { text: "What is your highest level of education completed?", type: "dropdown", options: ["High School / GED", "Associate's Degree", "Bachelor's Degree", "Master's Degree", "Doctorate (PhD)", "Other"] },
            { text: "How many years of relevant work experience do you have for this role?", type: "number" },
            { text: "Are you legally authorized to work in the country where this job is located?", type: "yes_no" },
            { text: "What are your salary expectations? (Optional)", type: "text" },
            { text: "Why are you interested in this position at our company?", type: "textarea" }, // Changed to textarea
            { text: "Please upload your CV (PDF or Image)", type: "file", options: ["image/*", ".pdf"] }
        ],
        lead: [
            { text: "What is your primary business goal or challenge?", type: "textarea" }, // Changed to textarea
            { text: "What is your current role/title?", type: "text" },
            { text: "What is your company's industry?", type: "text" },
            { text: "What is the approximate size of your company (number of employees)?", type: "dropdown", options: ["1-10", "11-50", "51-200", "201-1000", "1001+"] },
            { text: "What is your estimated budget for a solution?", type: "dropdown", options: ["Under $1,000", "$1,000 - $5,000", "$5,001 - $10,000", "$10,000+", "$25,000+", "Not Sure"] },
            { text: "How soon are you looking to implement a solution?", type: "dropdown", options: ["Immediately", "Within 3 months", "3-6 months", "6+ months", "Just Researching"] },
            { text: "Who are the key decision-makers involved in this purchase?", type: "text" }
        ],
        survey: [
            { text: "Overall, how satisfied were you with [Product/Service/Event]?", type: "rating" },
            { text: "How likely are you to recommend [Product/Service/Company] to a friend or colleague?", type: "rating", options: ["Scale 0-10"] },
            { text: "What did you like most about [Product/Service/Event]?", type: "textarea" }, // Changed to textarea
            { text: "What could we improve?", type: "textarea" }, // Changed to textarea
            { text: "Which features did you find most valuable? (Select all that apply)", type: "checkboxes", options: ["Feature A", "Feature B", "Feature C", "None"] },
            { text: "How easy was it to use [Product/Service]?", type: "dropdown", options: ["Very Easy", "Easy", "Neutral", "Difficult", "Very Difficult"] },
            { text: "Do you have any additional comments or suggestions?", type: "textarea" } // Changed to textarea
        ],
        support: [
            { text: "Please describe the issue you are experiencing in detail.", type: "textarea" }, // Changed to textarea
            { text: "What product or service does this issue relate to?", type: "text" },
            { text: "When did this issue first start occurring?", type: "text" }, // Consider type="date" in preview
            { text: "Have you tried any troubleshooting steps already? If yes, please list them.", type: "textarea" }, // Changed to textarea
            { text: "How urgent is this request?", type: "dropdown", options: ["Low - General Inquiry", "Medium - Minor Issue", "High - Significant Impact", "Critical - System Down"] },
            { text: "Please provide any relevant error messages, screenshots, or order numbers.", type: "textarea" }, // Changed to textarea
            { text: "What is the best way to contact you if we need more information?", type: "text" }
        ],
        custom: []
    };

     // --- Question Pool based on Priorities ---
     // This pool is used by the AI based on the weights, not directly by the editor.
     // Keeping this structure for potential future use, but the AI would generate questions
     // based on the weights and general instructions.
     const priorityQuestionPool = {
         qualification: [
             { text: "What is your highest level of education?", type: "dropdown", options: ["High School / GED", "Associate's Degree", "Bachelor's Degree", "Master's Degree", "Doctorate (PhD)", "Other"] },
             { text: "List any relevant certifications or licenses you hold.", type: "textarea" },
             { text: "Have you completed any specialized training relevant to this role?", type: "yes_no" },
             { text: "Please describe your academic background and how it relates to this position.", type: "textarea" }
         ],
         experience: [
             { text: "How many years of relevant work experience do you have?", type: "number" },
             { text: "Describe your responsibilities in your most recent role.", type: "textarea" },
             { text: "Tell us about a challenging project you worked on and how you overcame obstacles.", type: "textarea" },
             { text: "Describe a time you demonstrated leadership skills.", type: "textarea" },
             { text: "What is your biggest professional achievement to date?", type: "textarea" }
         ],
         skills: [
             { text: "List your top 3 technical skills relevant to this role.", type: "textarea" },
             { text: "Rate your proficiency in [Specific Skill/Tool, e.g., JavaScript] on a scale of 1-5.", type: "rating", options: ["Scale 1-5"] },
             { text: "Which programming languages are you proficient in? (Select all that apply)", type: "checkboxes", options: ["Python", "Java", "C++", "JavaScript", "Ruby", "Other"] },
             { text: "Describe a time you had to learn a new skill quickly for a project.", type: "textarea" },
             { text: "Upload your portfolio or work samples (optional).", type: "file", options: ["image/*", ".pdf", ".zip"] }
         ],
         culture_fit: [
             { text: "Describe your ideal work environment.", type: "textarea" },
             { text: "What values are most important to you in a company culture?", type: "textarea" },
             { text: "How do you handle conflict or disagreements within a team?", type: "textarea" },
             { text: "What motivates you in your work?", type: "textarea" },
             { text: "Describe a time you worked effectively with a diverse team.", type: "textarea" }
         ],
         technical_assessment: [
             { text: "Explain the concept of [Specific Technical Concept, e.g., RESTful APIs] in your own words.", type: "textarea" },
             { text: "Describe your experience with [Specific Technology/Framework, e.g., React].", type: "textarea" },
             { text: "Solve this coding challenge: [Provide a simple problem description or link].", type: "textarea" }, // Textarea for code/explanation
             { text: "What is your approach to debugging?", type: "textarea" }
         ],
         communication_skills: [
             { text: "How do you prefer to communicate with team members?", type: "textarea" },
             { text: "Describe a situation where you had to explain a complex idea to a non-technical audience.", type: "textarea" },
             { text: "How do you ensure clear and effective communication in a remote setting?", type: "textarea" },
             { text: "Rate your written communication skills (1-5).", type: "rating", options: ["Scale 1-5"] },
             { text: "Rate your verbal communication skills (1-5).", type: "rating", options: ["Scale 1-5"] }
         ]
     };


    // --- Application State ---
    let formQuestions = []; // Array to hold question objects
    let aiInstructionsManuallyEdited = false; // Flag to track if AI instructions were manually edited
    // Initialize with default priorities (e.g., equal weight)
    let currentHiringPriorities = {
        qualification: 17, // Approximately 100 / 6, adjusted to sum to 100
        experience: 17,
        skills: 17,
        culture_fit: 17,
        technical_assessment: 16,
        communication_skills: 16
    };
    let prioritiesEnabled = false; // State for the priority toggle switch


    // --- Utility Functions ---
    function generateUniqueId() {
        return 'q' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    function findQuestionIndexById(id) {
        return formQuestions.findIndex(q => q.id === id);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
        return array;
    }

    // --- Modal Functions ---
    function openModal(modalElement) {
        if (modalElement) {
            modalElement.style.display = 'flex'; // Use flex to enable centering
        }
    }

    function closeModal(modalElement) {
        if (modalElement) {
            modalElement.style.display = 'none'; // Use display block/none
        }
    }

    // --- Priority Weighting Logic (in Modal) ---
    // Define the specific hiring priorities with their labels
    const hiringPrioritiesList = [
        { id: 'qualification', label: '📚 Qualification' },
        { id: 'experience', label: '💼 Experience' },
        { id: 'skills', label: '🧠 Skills' },
        { id: 'culture_fit', label: '🤝 Culture Fit' },
        { id: 'technical_assessment', label: '🛠️ Technical Assessment' },
        { id: 'communication_skills', label: '📝 Communication Skills' }
    ];

    function renderPriorityInputsInModal() {
        if (!modalPriorityInputsDiv) {
             console.error("modalPriorityInputsDiv not found!");
             return;
        }

        modalPriorityInputsDiv.innerHTML = ''; // Clear existing inputs

        hiringPrioritiesList.forEach(p => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'priority-item';

            const label = document.createElement('label');
            label.setAttribute('for', `modal-priority-${p.id}`);
            label.innerText = p.label;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `modal-priority-${p.id}`;
            input.min = 0;
            input.max = 100;
            // Set initial value from saved priorities or default to 0
            input.value = currentHiringPriorities[p.id] !== undefined ? currentHiringPriorities[p.id] : 0;
            input.addEventListener('input', updateTotalWeightInModal);

            itemDiv.appendChild(label);
            itemDiv.appendChild(input);
            modalPriorityInputsDiv.appendChild(itemDiv);
        });

         // Ensure the toggle switch reflects the current state when the modal opens
         if (modalPrioritiesToggle) {
             modalPrioritiesToggle.checked = prioritiesEnabled;
         }

         updateTotalWeightInModal(); // Calculate initial total weight in modal
         // Also update the state of inputs based on the toggle
         togglePriorityInputsState();
    }

    function updateTotalWeightInModal() {
        if (!modalPriorityInputsDiv || !modalTotalWeightSpan || !modalWeightErrorDiv || !savePrioritiesButton) {
             console.error("One or more modal elements not found for weight update.");
             return;
        }

        const inputs = modalPriorityInputsDiv.querySelectorAll('input[type="number"]');
        let total = 0;
        inputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });

        modalTotalWeightSpan.innerText = total;
        const totalWeightContainer = modalTotalWeightSpan.closest('.total-weight');

        if (total !== 100) {
            if (totalWeightContainer) totalWeightContainer.classList.add('error');
            modalWeightErrorDiv.style.display = 'block';
            savePrioritiesButton.disabled = true;
        } else {
            if (totalWeightContainer) totalWeightContainer.classList.remove('error');
            modalWeightErrorDiv.style.display = 'none';
            savePrioritiesButton.disabled = false;
        }
    }

    function getPriorityWeightsFromModal() {
        const weights = {};
        if (!modalPriorityInputsDiv) return weights;

        hiringPrioritiesList.forEach(p => {
            const input = document.getElementById(`modal-priority-${p.id}`);
            weights[p.id] = parseInt(input ? input.value : 0) || 0;
        });
        return weights;
    }

    function savePrioritiesFromModal() {
        const weights = getPriorityWeightsFromModal();
        const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

        if (total !== 100) {
            // Error message is already shown by updateTotalWeightInModal
            return;
        }

        currentHiringPriorities = weights; // Save the weights to the application state
        prioritiesEnabled = modalPrioritiesToggle ? modalPrioritiesToggle.checked : false; // Update enabled state from modal toggle

        // Update the main button's appearance based on the new enabled state
        updateMainPriorityButtonAppearance();

        closeModal(priorityModal); // Close the modal

        console.log("Saved Hiring Priorities:", currentHiringPriorities, "Enabled:", prioritiesEnabled);
    }

    // Function to enable/disable priority input fields based on toggle state
    function togglePriorityInputsState() {
        if (!modalPrioritiesToggle || !modalPriorityInputsDiv) return;

        const inputs = modalPriorityInputsDiv.querySelectorAll('input[type="number"]');
        const isEnabled = modalPrioritiesToggle.checked;

        inputs.forEach(input => {
            input.disabled = !isEnabled;
        });

        // Also update the total display and error state based on the toggle
        if (!isEnabled) {
             // If disabled, clear total display and hide error
             if (modalTotalWeightSpan) modalTotalWeightSpan.innerText = 'N/A';
             if (modalWeightErrorDiv) modalWeightErrorDiv.style.display = 'none';
             const totalWeightContainer = modalTotalWeightSpan ? modalTotalWeightSpan.closest('.total-weight') : null;
             if (totalWeightContainer) totalWeightContainer.classList.remove('error');
             // Enable save button even if total is not 100 when disabled, as weights aren't being used
             if (savePrioritiesButton) savePrioritiesButton.disabled = false;

        } else {
            // If enabled, recalculate and show total/error
            updateTotalWeightInModal();
        }
    }


    // Function to update the appearance of the main "Set AI Priorities" button
    function updateMainPriorityButtonAppearance() {
        if (openPriorityModalButton) {
            // Check if Font Awesome is loaded before trying to use icons
            const checkFontAwesome = () => {
                const testElement = document.createElement('i');
                testElement.className = 'fas fa-check-circle'; // Use a common Font Awesome class
                document.body.appendChild(testElement);
                // Check if the computed content is not 'none' and has a width/height (basic check)
                const computedStyle = window.getComputedStyle(testElement, '::before');
                const isFontAwesomeLoaded = computedStyle.getPropertyValue('content') !== 'none' && (testElement.offsetWidth > 0 || testElement.offsetHeight > 0);
                document.body.removeChild(testElement);
                return isFontAwesomeLoaded;
            };

            const fontAwesomeLoaded = checkFontAwesome();

            if (prioritiesEnabled) {
                openPriorityModalButton.classList.remove('btn-secondary'); // Remove secondary style
                openPriorityModalButton.classList.add('toggle-on');
                openPriorityModalButton.classList.add('btn-primary'); // Use primary style when ON
                if (fontAwesomeLoaded) {
                     openPriorityModalButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Priorities ON'; // Add icon
                } else {
                     openPriorityModalButton.innerHTML = 'Priorities ON';
                }
            } else {
                openPriorityModalButton.classList.remove('toggle-on');
                openPriorityModalButton.classList.remove('btn-primary'); // Remove primary style
                openPriorityModalButton.classList.add('btn-secondary'); // Use secondary style when OFF
                 if (fontAwesomeLoaded) {
                    openPriorityModalButton.innerHTML = '<i class="fas fa-sliders-h mr-2"></i> Set AI Priorities'; // Add icon
                 } else {
                    openPriorityModalButton.innerHTML = 'Set AI Priorities';
                 }
            }
        }
    }


    // --- Core Logic Functions (Existing functions, potentially modified) ---
    // This function is less relevant now with AI generation based on priorities,
    // but kept for potential future use or fallback.
    function loadTemplateQuestions() {
        const selectedUseCase = useCaseSelect ? useCaseSelect.value : ''; // Check if element exists - Not in provided HTML
        // Clear questions only if a static template is selected, not for initial load or priority generation
        // if (selectedUseCase) {
        //     if (questionsContainer) questionsContainer.innerHTML = ""; // Check if element exists
        //     formQuestions = [];
        // }


        if (selectedUseCase && questionTemplates[selectedUseCase]) {
            // If a static template is selected, clear existing questions and load template
             if (questionsContainer) questionsContainer.innerHTML = ""; // Check if element exists
             formQuestions = [];

            const useCaseText = useCaseSelect.options[useCaseSelect.selectedIndex].text;
            if (questionsTitleElement) questionsTitleElement.innerText = `Questions (${useCaseText} Template):`; // Check if element exists
            const template = JSON.parse(JSON.stringify(questionTemplates[selectedUseCase]));
            template.forEach(qData => {
                addQuestionToDataAndUI(qData.text, qData.type, qData.options || [], false);
            });
             updateFormPreview(); // Update preview after loading template

             // Show question list and preview if a template is loaded
             if (questionListDiv) questionListDiv.classList.remove('hidden');
             if (formPreviewDiv) formPreviewDiv.classList.remove('hidden');

        } else if (selectedUseCase === 'custom') {
            if (questionsTitleElement) questionsTitleElement.innerText = "Your Questions (Custom):"; // Check if element exists
             // Don't clear questions here, allow manual adding
             updateFormPreview(); // Just update preview
             // Keep question list and preview hidden if starting custom and no questions yet
             if (formQuestions.length === 0) {
                 if (questionListDiv) questionListDiv.classList.add('hidden');
                 if (formPreviewDiv) formPreviewDiv.classList.add('hidden');
             } else {
                  // If there are already questions (e.g., from a previous generation), show them
                  if (questionListDiv) questionListDiv.classList.remove('hidden');
                  if (formPreviewDiv) formPreviewDiv.classList.remove('hidden');
             }

        } else {
            // Default state or no template selected
            if (questionsTitleElement) questionsTitleElement.innerText = "Your Questions:"; // Check if element exists
            // Don't clear questions, show whatever is there or empty state
            updateFormPreview(); // Just update preview
             // Hide question list and preview initially if no template is selected and no questions exist
             if (formQuestions.length === 0) {
                 if (questionListDiv) questionListDiv.classList.add('hidden');
                 if (formPreviewDiv) formPreviewDiv.classList.add('hidden');
             } else {
                  // If there are already questions (e.g., from a previous generation), show them
                  if (questionListDiv) questionListDiv.classList.remove('hidden');
                  if (formPreviewDiv) formPreviewDiv.classList.remove('hidden');
             }
        }
         // Note: AI suggestions will clear questions when run and then show the sections.
    }

    function addQuestionToDataAndUI(text = "", type = "text", options = [], isAISuggested = false) {
        const questionId = generateUniqueId();
        const newQuestionData = {
            id: questionId,
            text: text,
            type: type,
            options: Array.isArray(options) ? [...options] : [],
            isAISuggested: isAISuggested // Track if added via AI or priority generation
        };
        formQuestions.push(newQuestionData);
        renderQuestionInBuilder(newQuestionData);
        // updateFormPreview(); // Called after all questions are added (e.g., by generateFormFromPriorities or loadTemplateQuestions)

        // Ensure question list and preview are visible when a question is manually added
        if (questionListDiv) questionListDiv.classList.remove('hidden');
        if (formPreviewDiv) formPreviewDiv.classList.remove('hidden');
    }

    function removeQuestion(questionId) {
        const index = findQuestionIndexById(questionId);
        if (index !== -1) {
            formQuestions.splice(index, 1);
            const uiElement = document.querySelector(`.question-block[data-question-id="${questionId}"]`);
            if (uiElement) {
                uiElement.remove();
            }
            updateFormPreview();
             // Hide question list and preview if the last question is removed
             if (formQuestions.length === 0) {
                 if (questionListDiv) questionListDiv.classList.add('hidden');
                 if (formPreviewDiv) formPreviewDiv.classList.add('hidden');
             }
        }
    }

    function addOptionInput(questionId, optionText = "") {
        const questionIndex = findQuestionIndexById(questionId);
        if (questionIndex === -1) return;

        const optionsInputGroup = document.querySelector(`.question-block[data-question-id="${questionId}"] .options-input-group`);
        if (!optionsInputGroup) return;

        const optionWrapper = document.createElement("div");
        optionWrapper.className = "option-input-wrapper flex items-center gap-2"; // Add a class for styling and flex
        const optionInput = document.createElement("input");
        optionInput.type = "text";
        optionInput.placeholder = "Option text";
        optionInput.value = optionText;
        optionInput.className = "form-input flex-grow"; // Use form-input style and allow growing

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-option-btn";
        removeButton.innerHTML = '<i class="fas fa-times-circle"></i>'; // Use icon

        optionInput.oninput = () => {
            const inputs = optionsInputGroup.querySelectorAll('input[type="text"]');
            const optionIndex = Array.from(inputs).indexOf(optionInput);
            if (optionIndex !== -1 && formQuestions[questionIndex] && formQuestions[questionIndex].options) {
                 formQuestions[questionIndex].options[optionIndex] = optionInput.value;
                 updateFormPreview();
            }
        };

        removeButton.onclick = () => {
            const inputs = optionsInputGroup.querySelectorAll('input[type="text"]');
            const optionIndex = Array.from(inputs).indexOf(optionInput);
            if (optionIndex !== -1 && formQuestions[questionIndex] && formQuestions[questionIndex].options) {
                formQuestions[questionIndex].options.splice(optionIndex, 1);
                optionWrapper.remove();
                updateFormPreview();
                // It's good practice to call updateOptionsUI to ensure consistency,
                // especially if the last option was removed for a type that needs at least one.
                updateOptionsUI(formQuestions[questionIndex].type, questionId);
            }
        };

        optionWrapper.appendChild(optionInput);
        optionWrapper.appendChild(removeButton);
        optionsInputGroup.appendChild(optionWrapper);

        if (optionText === "" && formQuestions[questionIndex] && formQuestions[questionIndex].options) { // Ensure options array exists
             formQuestions[questionIndex].options.push("");
        }
    }

    function updateOptionsUI(selectedType, questionId) {
        const questionIndex = findQuestionIndexById(questionId);
        if (questionIndex === -1) return;

        const questionData = formQuestions[questionIndex]; // Get the question data
        const questionBlock = document.querySelector(`.question-block[data-question-id="${questionId}"]`);
        if (!questionBlock) return;

        const optionsContainer = questionBlock.querySelector(".options-input-group");
        const addOptionButton = questionBlock.querySelector(".add-option-btn");

        if (!optionsContainer || !addOptionButton) return;

        optionsContainer.innerHTML = ""; // Clear existing UI options

        if (["dropdown", "multiple_choice", "checkboxes"].includes(selectedType)) {
            optionsContainer.style.display = "flex";
            addOptionButton.style.display = "inline-block";
            if (questionData.options && questionData.options.length > 0) {
                questionData.options.forEach(optText => addOptionInput(questionId, optText));
            } else {
                addOptionInput(questionId, ""); // Add one empty if none exist
                if (!questionData.options) questionData.options = []; // Initialize if it was undefined
                if (questionData.options.length === 0) questionData.options.push(""); // Ensure data model has it
            }
        } else if (selectedType === 'rating') {
            optionsContainer.style.display = "flex";
            addOptionButton.style.display = "none";
            const ratingOptionsNote = document.createElement("p");
            ratingOptionsNote.style.cssText = "font-size:0.9em; color:#777; margin-bottom:0;";
            if (questionData.options && questionData.options.length > 0 && questionData.options[0].toLowerCase().includes('scale')) {
                ratingOptionsNote.innerText = `Rating scale: ${questionData.options.join(', ')}`;
            } else {
                ratingOptionsNote.innerText = `Rating scale: 1-5 (default)`;
            }
            optionsContainer.appendChild(ratingOptionsNote);
        } else { // text, number, textarea, yes_no, file
            optionsContainer.style.display = "none";
            addOptionButton.style.display = "none";
            // For types that don't use general options, clear the options array in the data model
            // Only if the type *changed* to one without options and it previously had options.
            // However, for 'yes_no' and 'file', options might be used internally (e.g. file types for 'file')
            // So, be more selective about clearing.
            if (!["yes_no", "file", "rating"].includes(selectedType)) { // Keep options for rating (scale), file (accept types)
                questionData.options = [];
            }
        }
    }


    function renderQuestionInBuilder(questionData) {
        if (!questionsContainer) { // Check if container exists
            console.error("questionsContainer not found!");
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "question-block";
        if (questionData.isAISuggested) {
            wrapper.classList.add("ai-suggested-question");
        }
        wrapper.dataset.questionId = questionData.id;

        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.placeholder = "Enter question text here";
        textInput.value = questionData.text;
        textInput.className = "form-input question-input"; // Use form-input style
        textInput.oninput = () => {
            questionData.text = textInput.value;
            updateFormPreview();
        };

        const typeSelect = document.createElement("select");
        typeSelect.className = "answer-type-select";
        typeSelect.innerHTML = `
            <option value="text">Text Input</option>
            <option value="number">Number Input</option>
            <option value="textarea">Text Area</option>
            <option value="dropdown">Dropdown</option>
            <option value="multiple_choice">Multiple Choice (Radio Buttons)</option>
            <option value="checkboxes">Checkboxes</option>
            <option value="yes_no">Yes/No (Radio Buttons)</option>
            <option value="rating">Rating (1-5 or 0-10)</option>
            <option value="file">File Upload</option>
        `;
        typeSelect.value = questionData.type;

        const optionsContainer = document.createElement("div");
        optionsContainer.className = "options-input-group";

        const addOptionButton = document.createElement("button");
        addOptionButton.type = "button";
        addOptionButton.className = "add-option-btn";
        addOptionButton.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Add Option'; // Add icon
        addOptionButton.onclick = () => addOptionInput(questionData.id);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.innerHTML = '<i class="fas fa-trash-alt mr-2"></i> Delete'; // Add icon
        deleteButton.onclick = () => removeQuestion(questionData.id);

        typeSelect.onchange = () => {
            questionData.type = typeSelect.value;
            // If changing to a type that doesn't use general options, clear them
            // but preserve for types like 'rating' (scale) or 'file' (accept types)
            if (!["dropdown", "multiple_choice", "checkboxes"].includes(questionData.type)) {
                if (questionData.type !== "rating" && questionData.type !== "file") { // Keep options for rating and file
                     // Only clear if it's not an AI suggested question with pre-filled options for rating/file
                    if (!questionData.isAISuggested || (questionData.isAISuggested && !["rating", "file"].includes(questionData.type))) {
                        questionData.options = [];
                    }
                }
            } else {
                // If changing to a type that *does* use options, and it has no options, add a default one
                if (!questionData.options || questionData.options.length === 0) {
                    questionData.options = [""];
                }
            }
            updateOptionsUI(questionData.type, questionData.id);
            updateFormPreview();
        };

        wrapper.appendChild(textInput);
        wrapper.appendChild(typeSelect);
        optionsContainer.appendChild(addOptionButton); // Add button inside options container
        wrapper.appendChild(optionsContainer); // Append container to wrapper
        wrapper.appendChild(deleteButton);
        questionsContainer.appendChild(wrapper);
        updateOptionsUI(questionData.type, questionData.id); // Initial call
    }

    function updateFormPreview() {
        // Corrected to use formPreviewDiv as the container for preview content
        if (!formPreviewDiv) { // Check if element exists
            console.error("formPreviewDiv not found!");
            return;
        }

        formPreviewDiv.innerHTML = ""; // Clear existing preview content

        if (formQuestions.length === 0) {
            formPreviewDiv.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>Add questions above to see the preview.</p>"; // Added padding
            return;
        }

        formQuestions.forEach((question, index) => {
            const questionElement = document.createElement("div");
            questionElement.className = "readonly-question";

            const questionText = document.createElement("p");
            questionText.innerText = `${index + 1}. ${question.text}`;
            questionElement.appendChild(questionText);

            let inputElement;
            switch (question.type) {
                case "text":
                    inputElement = document.createElement("input");
                    inputElement.type = "text";
                    inputElement.placeholder = "Your answer";
                    inputElement.className = "form-input"; // Use form-input style
                    break;
                case "number":
                    inputElement = document.createElement("input");
                    inputElement.type = "number";
                    inputElement.placeholder = "Enter a number";
                     inputElement.className = "form-input"; // Use form-input style
                    break;
                case "textarea":
                    inputElement = document.createElement("textarea");
                    inputElement.placeholder = "Your detailed answer";
                     inputElement.className = "form-textarea"; // Use form-textarea style
                    break;
                case "dropdown":
                    inputElement = document.createElement("select");
                     inputElement.className = "form-input"; // Use form-input style
                    if (question.options && question.options.length > 0) {
                        question.options.forEach(option => {
                            const optionElement = document.createElement("option");
                            optionElement.value = option;
                            optionElement.innerText = option;
                            inputElement.appendChild(optionElement);
                        });
                    } else {
                        inputElement.innerHTML = "<option value=''>No options available</option>";
                    }
                    break;
                case "multiple_choice":
                case "checkboxes":
                    const optionsContainer = document.createElement("div");
                    optionsContainer.className = question.type === "multiple_choice" ? "mc-options" : "cb-options";
                    const inputType = question.type === "multiple_choice" ? "radio" : "checkbox";
                    const nameAttribute = `q_prev_${question.id}`; // Unique name for preview radios

                    if (question.options && question.options.length > 0) {
                        question.options.forEach((option, optionIndex) => {
                            const optionLabel = document.createElement("label");
                            const optionInput = document.createElement("input");
                            optionInput.type = inputType;
                            optionInput.value = option;
                            if (question.type === "multiple_choice") { // Name only for radios
                                optionInput.name = nameAttribute;
                            }
                            const optionId = `prev_${question.id}_opt_${optionIndex}`;
                            optionInput.id = optionId;
                            optionLabel.setAttribute('for', optionId);

                            optionLabel.appendChild(optionInput);
                            optionLabel.appendChild(document.createTextNode(option));
                            optionsContainer.appendChild(optionLabel);
                        });
                    } else {
                        optionsContainer.innerHTML = "<p style='font-size:0.9em; color:#888;'>No options defined.</p>";
                    }
                    inputElement = optionsContainer;
                    break;
                case "yes_no":
                    const yesNoContainer = document.createElement("div");
                    yesNoContainer.className = "yes-no-options";
                    const yesNoName = `q_prev_${question.id}`; // Unique name for preview

                    const yesInput = document.createElement("input");
                    yesInput.type = "radio";
                    yesInput.name = yesNoName;
                    yesInput.value = "Yes";
                    yesInput.id = `prev_${question.id}_yes`;
                    const yesLabel = document.createElement("label");
                    yesLabel.setAttribute('for', `prev_${question.id}_yes`);
                    yesLabel.appendChild(yesInput);
                    yesLabel.appendChild(document.createTextNode("Yes"));

                    const noInput = document.createElement("input");
                    noInput.type = "radio";
                    noInput.name = yesNoName;
                    noInput.value = "No";
                    noInput.id = `prev_${question.id}_no`;
                    const noLabel = document.createElement("label");
                    noLabel.setAttribute('for', `prev_${question.id}_no`);
                    noLabel.appendChild(noInput);
                    noLabel.appendChild(document.createTextNode("No"));

                    yesNoContainer.appendChild(yesLabel);
                    yesNoContainer.appendChild(noLabel);
                    inputElement = yesNoContainer;
                    break;
                case "rating":
                    const ratingContainer = document.createElement("div");
                    ratingContainer.className = "rating-options";
                    const ratingName = `q_prev_${question.id}`; // Unique name for preview
                    const ratingOptions = (question.options && question.options.length > 0 && question.options[0].toLowerCase().includes('scale'))
                        ? Array.from({ length: parseInt(question.options[0].split('-')[1] || 5) }, (_, i) => i + 1)
                        : [1, 2, 3, 4, 5];

                    ratingOptions.forEach(value => {
                        const ratingLabel = document.createElement("label");
                        const ratingInput = document.createElement("input");
                        ratingInput.type = "radio";
                        ratingInput.name = ratingName;
                        ratingInput.value = value;
                        ratingInput.id = `prev_${question.id}_rating_${value}`;

                        ratingLabel.setAttribute('for', `prev_${question.id}_rating_${value}`);
                        ratingLabel.appendChild(ratingInput);
                        ratingLabel.appendChild(document.createTextNode(value));
                        ratingContainer.appendChild(ratingLabel);
                    });
                    inputElement = ratingContainer;
                    break;
                 case "file":
                     inputElement = document.createElement("input");
                     inputElement.type = "file";
                     inputElement.className = "form-input"; // Use form-input style
                     if (question.options && question.options.length > 0) {
                         inputElement.accept = question.options.join(',');
                     }
                     // Add a small note about file type
                     const fileNote = document.createElement('p');
                     fileNote.style.fontSize = '0.8em';
                     fileNote.style.color = '#777';
                     fileNote.textContent = question.options && question.options.length > 0 ? `Accepted types: ${question.options.join(', ')}` : 'Accepts any file type.';
                     questionElement.appendChild(fileNote); // Append note after input
                     break;
                default:
                    inputElement = document.createElement("p");
                    inputElement.innerText = `[Unsupported Answer Type: ${question.type}]`;
                    inputElement.style.color = 'red';
                    break;
            }

            if (inputElement) {
                questionElement.appendChild(inputElement);
            }
            formPreviewDiv.appendChild(questionElement); // Append to the preview div
        });
    }

    async function saveAndPublishForm() {
        // Get the current authenticated user
        const user = firebase.auth().currentUser;
        if (!user) {
            alert("You must be logged in to save a form.");
            // Redirect to login page or show login modal
            window.location.href = 'login.html';
            return;
        }

        if (!databaseURL || databaseURL.includes("YOUR_DATABASE_URL") || databaseURL.length < 20) { // Basic check
            console.error("Firebase Realtime Database URL is not configured. Cannot save form.");
            if (publishStatusDiv) { // Check if element exists
                publishStatusDiv.style.display = 'block';
                publishStatusDiv.className = 'error-message';
                publishStatusDiv.innerHTML = 'Error: Firebase Realtime Database URL is not configured. Please check your firebaseConfig in index.html.';
            }
            return;
        }

        const formName = formNameInput ? formNameInput.value.trim() : ''; // Check if element exists
        if (!formName) {
            alert("Please enter a name for your form.");
            return;
        }
        if (formQuestions.length === 0) {
            alert("Please add at least one question to your form.");
            return;
        }

         // Only require weights to sum to 100% if priorities are enabled
         if (prioritiesEnabled) {
              const total = Object.values(currentHiringPriorities).reduce((sum, weight) => sum + weight, 0);
              if (total !== 100) {
                   alert("Please ensure the saved priority weights add up to 100% before saving.");
                   return;
              }
         }


        if (publishStatusDiv) { // Check if element exists
            publishStatusDiv.style.display = 'block';
            publishStatusDiv.className = 'loading-message';
            publishStatusDiv.innerHTML = 'Saving form...';
        }
        if (savePublishButton) savePublishButton.disabled = true; // Check if element exists


        const questionsToSave = formQuestions.map(q => {
            const { isAISuggested, ...rest } = q;
            return rest;
        });

        const now = new Date().toISOString();

        const fullFormData = {
            name: formName,
            questions: questionsToSave,
            createdAt: now,
            owner: user.uid, // Link the form to the user
            // Include hiringPriorities only if enabled and total is 100%
            ...(prioritiesEnabled && Object.values(currentHiringPriorities).reduce((sum, weight) => sum + weight, 0) === 100 && { hiringPriorities: currentHiringPriorities })
        };

         // Create a reference for the new form under the global 'forms' node
        const newFormRef = firebase.database().ref('forms').push();
        const formId = newFormRef.key;
        console.log("Generated new form ID:", formId);


        // Data to save under the user's node (metadata for dashboard)
        const userFormData = {
            name: formName,
            createdAt: now,
            submissionCount: 0 // Initialize submission count
        };

        try {
            // Use a multi-location update to save to both /forms and /users/{userId}/forms
            const updates = {};
            updates['/forms/' + formId] = fullFormData;
            updates['/users/' + user.uid + '/forms/' + formId] = userFormData;

            await firebase.database().ref().update(updates);

            console.log("Form saved successfully with ID:", formId, "under user:", user.uid);

            const previewUrl = `${window.location.origin}/preview.html?formId=${formId}`;
            const resultsUrl = `${window.location.origin}/result.html?formId=${formId}`; // Corrected to result.html

            if (publishStatusDiv) { // Check if element exists
                publishStatusDiv.className = 'success-message published-links-container';
                publishStatusDiv.innerHTML = `
                    <p>Form saved successfully!</p>
                    <div class="link-buttons">
                        <button class="copy-link-btn" data-link="${previewUrl}"><i class="fas fa-copy mr-2"></i> Copy Link for Responder</button>
                        <button class="view-results-btn" data-link="${resultsUrl}"><i class="fas fa-poll-h mr-2"></i> View Results</button>
                    </div>
                `;

                // Add event listeners after buttons are added to the DOM
                const copyButton = publishStatusDiv.querySelector('.copy-link-btn');
                const viewButton = publishStatusDiv.querySelector('.view-results-btn');

                if (copyButton) copyButton.addEventListener('click', handleCopyLink);
                if (viewButton) viewButton.addEventListener('click', handleViewResults);
            }


        } catch (error) {
            console.error("Error saving form to Firebase Realtime Database: ", error);
            if (publishStatusDiv) { // Check if element exists
                publishStatusDiv.className = 'error-message';
                publishStatusDiv.innerHTML = `Error saving form: ${error.message}`;
            }
        } finally {
             if (savePublishButton) savePublishButton.disabled = false; // Check if element exists
        }
    }

    function handleCopyLink(event) {
        const linkToCopy = event.target.dataset.link;
        navigator.clipboard.writeText(linkToCopy).then(() => {
            const originalText = event.target.innerHTML;
            event.target.innerHTML = '<i class="fas fa-check mr-2"></i> Copied!'; // Change text and add icon
            setTimeout(() => {
                event.target.innerHTML = originalText; // Revert after a delay
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy link: ', err);
            alert('Failed to copy link. Please copy it manually: ' + linkToCopy);
        });
    }

    function handleViewResults(event) {
        const resultsLink = event.target.dataset.link;
        window.open(resultsLink, '_blank');
    }

    // --- Event Listeners ---
    // Add checks to ensure elements exist before adding listeners
    if (useCaseSelect) useCaseSelect.addEventListener("change", loadTemplateQuestions); // Keep static template loading for now
    if (addManualQuestionButton) {
         console.log("editor.js: Attaching listener to Add Manual Question button.");
         addManualQuestionButton.addEventListener("click", () => {
             console.log("editor.js: Add Manual Question button clicked.");
             addQuestionToDataAndUI("", "text", [], false);
         });
    } else {
         console.warn("editor.js: Add Manual Question button not found.");
    }

    if (savePublishButton) {
         console.log("editor.js: Attaching listener to Save & Publish button.");
         savePublishButton.addEventListener("click", () => {
             console.log("editor.js: Save & Publish button clicked.");
             saveAndPublishForm();
         });
    } else {
         console.warn("editor.js: Save & Publish button not found.");
    }


    // Scroll to Form Title section when Get Started is clicked
    if (getStartedButton && formNameInput) { // Target the formNameInput for scrolling
         getStartedButton.addEventListener('click', () => {
              console.log("editor.js: Get Started button clicked. Scrolling to form name.");
              // Calculate the target scroll position (top of formNameInput)
              const targetPosition = formNameInput.getBoundingClientRect().top + window.scrollY - scrollOffset;

              // Use window.scrollTo for smooth scrolling with offset
              window.scrollTo({
                  top: targetPosition,
                  behavior: 'smooth'
              });
         });
    } else {
         console.warn("editor.js: Get Started button or Form Name Input not found. Scrolling disabled.");
    }


    // Get AI Form Button Logic
    if (getAIFormButton && instructionBox && formNameInput && questionsContainer && questionsTitleElement && typeof addQuestionToDataAndUI === 'function' && typeof updateFormPreview === 'function') {
        console.log("editor.js: Attaching listener to Get AI Suggestions button.");
        getAIFormButton.addEventListener("click", () => {
            console.log("editor.js: Get AI Suggestions button clicked.");
            const formName = formNameInput ? formNameInput.value.trim() : ''; // Check if element exists
            const instructions = instructionBox ? instructionBox.value.trim() : ''; // Check if element exists


            if (!formName) {
                alert("Please enter a name for your form.");
                return;
            }

            const dataToSend = {
                 formName: formName,
                 instructions: instructions
            };

            // Include priorities only if the toggle is ON and the saved weights sum to 100%
            if (prioritiesEnabled) {
                const total = Object.values(currentHiringPriorities).reduce((sum, weight) => sum + weight, 0);
                if (total === 100) { // Only send if total is 100%
                     dataToSend.hiringPriorities = currentHiringPriorities;
                     console.log("editor.js: Sending priorities to AI:", currentHiringPriorities);
                } else {
                     alert("Please ensure saved priority weights add up to 100% to include them in AI generation.");
                     // Continue sending without priorities if total is not 100
                     console.warn("editor.js: Priorities enabled but total weight is not 100%. Sending instructions only.");
                }
            } else {
                 console.log("editor.js: Priorities are not enabled. Sending instructions only.");
            }


            // Pass the data object and necessary functions to the webhook function
            sendDataToWebhook(dataToSend, questionsContainer, questionsTitleElement, addQuestionToDataAndUI, updateFormPreview);
        });

        // Auto-suggest AI instructions based on form name
        if (formNameInput && instructionBox) { // Check if elements exist
            formNameInput.addEventListener('input', () => {
                // Only auto-suggest if the user hasn't manually edited the instructions
                if (!aiInstructionsManuallyEdited) {
                     const formName = formNameInput.value.trim();

                     if (formName) {
                         // Suggest prompt based on form name, focusing on hiring context
                         instructionBox.value = `Create questions to screen candidates for the "${formName}" position.`;

                     } else {
                         instructionBox.value = ''; // Clear if form name is empty
                     }
                }
            });
        } else {
             console.warn("editor.js: Form Name Input or Instruction Box not found. Auto-suggestion disabled.");
        }


        // Set flag when user manually edits the instructions
        if (instructionBox) { // Check if element exists
            instructionBox.addEventListener('input', () => {
                 aiInstructionsManuallyEdited = true;
            });
        }


    } else {
        console.warn("editor.js: Get AI Form button or related elements not found. AI suggestions feature disabled.");
    }

    // Removed Generate Form Button Logic (replaced by Get AI Form Button or manual add)


    // Open Priorities Modal Button Logic
    if (openPriorityModalButton && priorityModal && modalPrioritiesToggle) {
        console.log("editor.js: Attaching listener to Set AI Priorities button.");
        openPriorityModalButton.addEventListener('click', () => {
             console.log("editor.js: Set AI Priorities button clicked. Opening modal.");
             // Render the inputs in the modal (this also sets initial values and total)
             renderPriorityInputsInModal();
             // Open the modal
             openModal(priorityModal);
        });
    } else {
         console.warn("editor.js: Open Priorities Modal button or modal not found.");
    }

    // Save Priorities Button Listener
    if (savePrioritiesButton) {
        console.log("editor.js: Attaching listener to Save Priorities button.");
        savePrioritiesButton.addEventListener('click', () => {
            console.log("editor.js: Save Priorities button clicked.");
            savePrioritiesFromModal();
        });
    } else {
        console.warn("editor.js: Save Priorities button not found.");
    }

    // Listen for change on the modal toggle switch
    if (modalPrioritiesToggle) {
        console.log("editor.js: Attaching change listener to priority toggle switch.");
        modalPrioritiesToggle.addEventListener('change', () => {
            console.log("editor.js: Priority toggle switch changed.");
            // When the toggle changes in the modal, update the prioritiesEnabled state
            prioritiesEnabled = modalPrioritiesToggle.checked;
            // Update the appearance of the main button immediately
            updateMainPriorityButtonAppearance();
            // Toggle the state of the priority input fields
            togglePriorityInputsState();
             console.log("editor.js: Priority toggle in modal changed. Enabled:", prioritiesEnabled);
        });
    } else {
        console.warn("editor.js: Modal priority toggle switch not found.");
    }

    // Close button for the priority modal
    if (closePrioritiesModalButton && priorityModal) {
        console.log("editor.js: Attaching listener to Close Priorities Modal button.");
        closePrioritiesModalButton.addEventListener('click', () => {
            console.log("editor.js: Close Priorities Modal button clicked.");
            closeModal(priorityModal);
        });
    } else {
        console.warn("editor.js: Close Priorities Modal button not found.");
    }


    // General Modal Event Listeners (for signup/login and priority modal)
    // Open modals - These elements are expected to be in index.html if used, but the event
    // listeners for opening them are handled by auth.js based on your previous setup.
    // We only need the close logic here via delegation.
    // Removed duplicate declarations causing SyntaxError
    // const signupButton = document.getElementById("signupButton");
    // const signupModal = document.getElementById("signupModal");
    // const loginButton = document.getElementById("loginButton");
    // const loginModal = document.getElementById("loginModal");


    // Use event delegation for close buttons on any modal
    document.body.addEventListener('click', function(event) {
        // Check if the clicked element or any of its parents have the 'close-button' class
        if (event.target.closest('.close-button')) {
            console.log("editor.js: Close button clicked via delegation.");
            // Find the closest modal parent and close it
            const modalToClose = event.target.closest(".modal"); // Look for the modal class
            if (modalToClose) {
                 console.log("editor.js: Closing modal via delegation.");
                 closeModal(modalToClose);
            } else {
                 console.log("editor.js: Close button clicked, but no parent modal found.");
            }
        }
    });

    // Close modals by clicking outside the modal content (event delegation)
    document.body.addEventListener('click', function(event) {
        // Check if the click target is a modal overlay (the modal div itself)
        // AND if the click was directly on the modal div (not inside modal-content)
        if (event.target.classList.contains('modal') && !event.target.closest('.modal-content')) {
             console.log("editor.js: Clicked outside modal content via delegation.");
             // Find the specific modal that was clicked
            const clickedModal = event.target;
            // We can simplify this to just close any element with the 'modal' class if clicked outside its content
             closeModal(clickedModal);
        }
    });


    // --- Initial Load ---
    // loadTemplateQuestions(); // Load default template questions initially (can be removed or modified) - Not needed if starting empty

    // Hide question list and preview initially if no questions
    if (questionListDiv && formPreviewDiv) { // Check if elements exist
        if (formQuestions.length === 0) {
             questionListDiv.classList.add('hidden');
             formPreviewDiv.classList.add('hidden');
             console.log("editor.js: No initial questions, hiding question list and preview.");
        } else {
             // If there are initial questions (e.g., from a loaded form), show them
             questionListDiv.classList.remove('hidden');
             formPreviewDiv.classList.remove('hidden');
             updateFormPreview(); // Render initial questions in preview
             console.log("editor.js: Initial questions found, showing question list and preview.");
        }
    } else {
         console.warn("editor.js: Question list or form preview elements not found. Initial state logic skipped.");
    }


    // The editor container is now always visible in the HTML, no need to hide/show here.

    // Initialize the main priority button appearance
    updateMainPriorityButtonAppearance();

    console.log("editor.js: DOMContentLoaded finished.");
});
