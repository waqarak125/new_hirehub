// This script should be linked in result.html using <script src="result.js" defer></script>

// firebaseConfig and ANALYSIS_WEBHOOK_URL are expected to be globally defined in result.html <head>

// Declare databaseURL variable globally in this script's scope
let databaseURL = firebaseConfig.databaseURL;
let currentFormId = null; // To store the formId from URL, accessible throughout the script
let allSubmissions = []; // Store fetched submissions for sorting

// Initialize Firebase App (This block is already in result.html, no need to repeat here)
// if (!firebase.apps.length) {
//     try {
//          firebase.initializeApp(firebaseConfig);
//          console.log("Firebase App initialized successfully from result.js.");
//     } catch (error) {
//          console.error("Error initializing Firebase App from result.js:", error);
//          const resultsDisplay = document.getElementById("resultsDisplay");
//          if (resultsDisplay) {
//             resultsDisplay.innerHTML = `<p class="error-message">Error initializing Firebase App: ${error.message}. Please check your firebaseConfig and the browser console for details.</p>`;
//          }
//          const resultsHeader = document.getElementById("resultsHeader");
//          if (resultsHeader) resultsHeader.innerText = "Error Loading Results";
//          const formNameTitleEl = document.getElementById("formNameTitle"); // Corrected variable name
//          if (formNameTitleEl) formNameTitleEl.innerText = ""; // Clear title
//     }
// } else {
//     firebase.app(); // if already initialized, use that app
//     console.log("Firebase App already initialized (checked from result.js).");
// }

// --- Run Code After DOM is Loaded ---
document.addEventListener('DOMContentLoaded', async () => {
    const resultsDisplay = document.getElementById("resultsDisplay");
    const formNameTitleEl = document.getElementById("formNameTitle");
    const compareCandidatesButton = document.getElementById('compareCandidatesButton');
    const sortOrderSelect = document.getElementById('sortOrder'); // Get the sort select element


    const urlParams = new URLSearchParams(window.location.search);
    currentFormId = urlParams.get('formId'); // Assign to the script-level currentFormId

    console.log("Current Form ID from URL:", currentFormId);

    if (!currentFormId) {
        if (resultsDisplay) resultsDisplay.innerHTML = "<p class='error-message'><i class='fas fa-exclamation-circle mr-2'></i> Error: No form ID provided in the URL.</p>";
        if (formNameTitleEl) formNameTitleEl.innerText = "Error Loading Results";
        if (compareCandidatesButton) compareCandidatesButton.disabled = true;
         if (sortOrderSelect) sortOrderSelect.disabled = true; // Disable sort if no form ID
        return;
    }

    // Setup Compare Candidates button listener
    if (compareCandidatesButton) {
        compareCandidatesButton.addEventListener('click', () => {
            if (currentFormId) {
                const compareUrl = `compare.html?formId=${currentFormId}`; // Simpler relative path
                window.open(compareUrl, '_blank'); // Open in a new tab
                console.log("Opening compare page for formId:", currentFormId);
            } else {
                alert("Form ID is not available to compare candidates.");
                console.error("Compare button clicked but currentFormId is not set or is invalid.");
            }
        });
    } else {
        console.error("Compare Candidates Button not found in the DOM.");
    }

     // Setup Sort Order select listener
     if (sortOrderSelect) {
         sortOrderSelect.addEventListener('change', () => {
             renderSubmissions(allSubmissions); // Re-render based on the current sort order
         });
     } else {
         console.error("Sort Order Select element not found.");
     }


    if (!databaseURL || databaseURL.includes("YOUR_DATABASE_URL")) {
        console.error("Firebase Realtime Database URL is not configured. Cannot load submissions.");
        if (resultsDisplay) resultsDisplay.innerHTML = "<p class='error-message'><i class='fas fa-exclamation-circle mr-2'></i> Error: Firebase Realtime Database URL is not configured.</p>";
        if (formNameTitleEl) formNameTitleEl.innerText = "Error Loading Results - DB Config";
        if (compareCandidatesButton) compareCandidatesButton.disabled = true;
         if (sortOrderSelect) sortOrderSelect.disabled = true;
        return;
    }

    try {
         // Fetch the form name first to display it
         console.log(`Fetching form name for ID: ${currentFormId}`);
         const formResponse = await fetch(`${databaseURL}/forms/${currentFormId}/name.json`);
         let formName = currentFormId; // Default to ID if name fetch fails
         if (formResponse.ok) {
              formName = await formResponse.json() || `Form ID: ${currentFormId}`; // Display ID if name is empty
              console.log("Form name fetched:", formName);
         } else {
              console.warn(`Could not fetch form name for ID ${currentFormId}. Status: ${formResponse.status}`);
         }
         if (formNameTitleEl) formNameTitleEl.innerText = `Results for: ${formName}`;


         // --- Corrected: Fetch submissions from /formSubmissions/{formId} ---
        console.log(`Fetching submissions for form ID: ${currentFormId} from /formSubmissions/${currentFormId}`);
        const submissionsResponse = await fetch(`${databaseURL}/formSubmissions/${currentFormId}.json`);

         if (!submissionsResponse.ok) {
             const errorText = await submissionsResponse.text();
             throw new Error(`HTTP error! status: ${submissionsResponse.status}, message: ${errorText}`);
         }

        const submissions = await submissionsResponse.json();
        console.log(`Fetched submissions for form ID ${currentFormId}:`, submissions);

        if (resultsDisplay) resultsDisplay.innerHTML = ""; // Clear loading message

        if (submissions && Object.keys(submissions).length > 0) {
            console.log(`${Object.keys(submissions).length} submissions found.`);

            // Convert submissions object to an array for easier sorting and processing
            // The structure is now { submissionId: { ...data } } under /formSubmissions/{formId}
            allSubmissions = Object.entries(submissions).map(([id, data]) => ({ id, ...data }));

            renderSubmissions(allSubmissions); // Render the fetched submissions

            if (compareCandidatesButton) {
                console.log("Enabling Compare Candidates button.");
                compareCandidatesButton.disabled = false; // Enable the button
            }
             if (sortOrderSelect) sortOrderSelect.disabled = false; // Enable sort
        } else {
            console.log("No submissions found for this form or submissions object is empty/null.");
            if (resultsDisplay) resultsDisplay.innerHTML = "<p class='no-results-message'><i class='fas fa-inbox mr-2'></i> No submissions found yet for this form.</p>";
            if (compareCandidatesButton) {
                console.log("Keeping Compare Candidates button disabled (no submissions).");
                compareCandidatesButton.disabled = true;
            }
             if (sortOrderSelect) sortOrderSelect.disabled = true;
        }
    } catch (error) {
        console.error("Error fetching submissions from Realtime Database: ", error);
        if (resultsDisplay) resultsDisplay.innerHTML = `<p class='error-message'><i class='fas fa-exclamation-circle mr-2'></i> Error loading submissions: ${error.message}</p>`;
        if (formNameTitleEl) formNameTitleEl.innerText = "Error Loading Results - Fetch Error";
        if (compareCandidatesButton) {
            console.log("Keeping Compare Candidates button disabled (error).");
            compareCandidatesButton.disabled = true;
        }
         if (sortOrderSelect) sortOrderSelect.disabled = true;
    }
});

/**
 * Renders a list of submission blocks based on the provided array.
 * Applies sorting based on the selected sort order.
 * @param {Array<object>} submissionsArray - Array of submission objects.
 */
function renderSubmissions(submissionsArray) {
    const resultsDisplay = document.getElementById("resultsDisplay");
     const sortOrderSelect = document.getElementById('sortOrder');
     const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc'; // Default to descending

    if (!resultsDisplay) {
        console.error("resultsDisplay element not found in renderSubmissions");
        return;
    }

    resultsDisplay.innerHTML = ""; // Clear existing submissions

    if (!submissionsArray || submissionsArray.length === 0) {
         resultsDisplay.innerHTML = "<p class='no-results-message'><i class='fas fa-inbox mr-2'></i> No submissions found yet for this form.</p>";
         const compareCandidatesButton = document.getElementById('compareCandidatesButton');
         if (compareCandidatesButton) compareCandidatesButton.disabled = true;
          if (sortOrderSelect) sortOrderSelect.disabled = true;
         return;
    }

    // Sort the submissions array
    const sortedSubmissions = [...submissionsArray].sort((a, b) => {
        const timeA = new Date(a.submittedAt || 0).getTime();
        const timeB = new Date(b.submittedAt || 0).getTime();
        if (sortOrder === 'asc') {
            return timeA - timeB; // Ascending order (Oldest first)
        } else {
            return timeB - timeA; // Descending order (Newest first)
        }
    });


    sortedSubmissions.forEach(submission => {
        renderSubmissionBlock(submission.id, submission); // Render each sorted submission
    });
}


/**
 * Renders a single submission block, including Q&A and the AI analysis section.
 * @param {string} submissionId - The unique ID of the submission.
 * @param {object} submissionData - The data for the submission.
 */
function renderSubmissionBlock(submissionId, submissionData) {
    const resultsDisplay = document.getElementById("resultsDisplay");
    if (!resultsDisplay) {
        console.error("resultsDisplay element not found in renderSubmissionBlock");
        return;
    }
    const submissionBlock = document.createElement("div");
    submissionBlock.className = "submission-block";
    submissionBlock.dataset.submissionId = submissionId; // Add data attribute

    // Submission Title (Timestamp)
    const submissionTitle = document.createElement("h3");
    submissionTitle.innerText = `Submission ${new Date(submissionData.submittedAt || Date.now()).toLocaleString()}`;
    submissionBlock.appendChild(submissionTitle);

    // Submission Details (IDs)
    const submissionDetails = document.createElement("div");
    submissionDetails.className = "submission-details";
     submissionDetails.innerHTML = `
         <span><strong>Submission ID:</strong> ${submissionId}</span>
         ${submissionData.formId ? `<span><strong>Form ID:</strong> ${submissionData.formId}</span>` : ''}
     `;
    submissionBlock.appendChild(submissionDetails);

    // Render Questions and Answers
    // Check for the 'responses' array structure first, fallback to old 'answers' if needed
    const responsesArray = submissionData.responses && Array.isArray(submissionData.responses) ? submissionData.responses : (submissionData.answers && Array.isArray(submissionData.answers) ? submissionData.answers : []);


    if (responsesArray.length > 0) {
        responsesArray.forEach(response => {
            const qaElement = document.createElement("div");
            qaElement.className = "question-answer";

            const questionTextEl = document.createElement("p");
            // Use questionText from the response object if available, fallback to 'Unnamed Question'
            questionTextEl.innerHTML = `<strong>Q:</strong> ${response.questionText || 'Unnamed Question'}`;
            qaElement.appendChild(questionTextEl);

            const answerTextEl = document.createElement("p");
            let answerContent = response.answer;

            if (Array.isArray(answerContent)) {
                answerContent = answerContent.join(', ');
            } else if (answerContent === null || answerContent === undefined || answerContent === '') {
                answerContent = '<i>No answer provided</i>';
            } else if (typeof answerContent === 'string' && (answerContent.startsWith('http://') || answerContent.startsWith('https://'))) {
                 // Make file URLs clickable links
                 answerContent = `<a href="${answerContent}" target="_blank" rel="noopener noreferrer">${answerContent}</a>`;
            }

            answerTextEl.innerHTML = `<strong>A:</strong> ${answerContent}`;
            qaElement.appendChild(answerTextEl);
            submissionBlock.appendChild(qaElement);
        });
    } else {
        const noResponses = document.createElement("p");
        noResponses.innerText = "No responses recorded for this submission.";
        submissionBlock.appendChild(noResponses);
    }

    // --- Add AI Analysis Section ---
    const aiSection = document.createElement("div");
    aiSection.className = "ai-analysis-section";

    const requirementsLabel = document.createElement("label");
    requirementsLabel.setAttribute("for", `requirements-input-${submissionId}`);
    requirementsLabel.textContent = "Optional: Enter Specific Requirements/Thresholds for AI Analysis";
    aiSection.appendChild(requirementsLabel);

    const requirementsTextarea = document.createElement("textarea");
    requirementsTextarea.id = `requirements-input-${submissionId}`;
    requirementsTextarea.placeholder = "e.g., Must have 5+ years experience in Java, Strong communication skills needed, Minimum education: Bachelor's degree...";
    aiSection.appendChild(requirementsTextarea);

    const analyzeButton = document.createElement("button");
    analyzeButton.className = "ai-analysis-button"; // Use harmonized button class
    analyzeButton.innerHTML = `<i class="fas fa-robot mr-2"></i> Analyze Candidate Fit (AI)`; // Added icon
    // Use an anonymous function to pass parameters to handleAIAnalysis
    analyzeButton.onclick = () => handleAIAnalysis(submissionId, submissionData, analyzeButton, `requirements-input-${submissionId}`);
    aiSection.appendChild(analyzeButton);

    const aiResultHeading = document.createElement("h4");
    aiResultHeading.className = "ai-result-heading";
    aiResultHeading.innerHTML = `<span><i class="fas fa-brain mr-1"></i></span> AI Analysis Result:`; // Added icon
    aiResultHeading.style.display = 'none'; // Hide initially
    aiSection.appendChild(aiResultHeading);

    const analysisResultDiv = document.createElement("div");
    analysisResultDiv.className = "ai-analysis-result";
    analysisResultDiv.id = `ai-result-${submissionId}`; // Unique ID for result display
    analysisResultDiv.style.display = 'none'; // Hide initially
    aiSection.appendChild(analysisResultDiv);

    submissionBlock.appendChild(aiSection);
    resultsDisplay.appendChild(submissionBlock);
}

/**
 * Handles the click event for the AI analysis button.
 * @param {string} submissionId - The ID of the submission to analyze.
 * @param {object} submissionData - The full data object for the submission.
 * @param {HTMLButtonElement} buttonElement - The button that was clicked.
 * @param {string} requirementsTextareaId - The ID of the textarea containing custom requirements.
 */
async function handleAIAnalysis(submissionId, submissionData, buttonElement, requirementsTextareaId) {
    const resultDiv = document.getElementById(`ai-result-${submissionId}`);
    // Find the heading by selecting the element with class 'ai-result-heading' that is a sibling of the resultDiv
    const aiSection = buttonElement.closest('.ai-analysis-section');
    const resultHeading = aiSection ? aiSection.querySelector('.ai-result-heading') : null;
    const requirementsTextarea = document.getElementById(requirementsTextareaId);

    if (!resultDiv || !resultHeading || !requirementsTextarea) {
        console.error("AI analysis display elements not found for submission:", submissionId);
        return;
    }

     if (!ANALYSIS_WEBHOOK_URL || ANALYSIS_WEBHOOK_URL === "YOUR_N8N_ANALYSIS_WEBHOOK_URL" || ANALYSIS_WEBHOOK_URL.length < 20) {
         console.error("AI Analysis Webhook URL is not configured.");
         resultDiv.innerHTML = "<p><i class='fas fa-exclamation-circle mr-2'></i> Error: AI Analysis endpoint is not configured in the script.</p>";
         resultDiv.className = "ai-analysis-result error";
         resultDiv.style.display = 'block';
         resultHeading.style.display = 'block';
         return;
     }

    buttonElement.disabled = true;
     buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Analyzing...`; // Loading text with icon
    resultDiv.innerHTML = "<p class='loading'><i class='fas fa-spinner fa-spin mr-2'></i> Contacting AI assistant...</p>";
    resultDiv.className = "ai-analysis-result loading";
    resultDiv.style.display = 'block';
    resultHeading.style.display = 'block';

    const customRequirements = requirementsTextarea.value.trim();
    const analysisPayload = {
         submissionId: submissionId,
         formId: submissionData.formId,
         jobRequirements: customRequirements, // Include custom requirements
         // Ensure responses are in the expected format for the webhook
         responses: submissionData.responses && Array.isArray(submissionData.responses) ?
                    submissionData.responses.map(r => ({
                         question: r.questionText,
                         // Ensure answer is a string or null, join arrays
                         answer: Array.isArray(r.answer) ? r.answer.join(', ') : (r.answer ?? '')
                    }))
                    : [] // Provide an empty array if responses are missing or not an array
    };

    console.log("Sending data for AI analysis:", analysisPayload);

    try {
        const response = await fetch(ANALYSIS_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(analysisPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI analysis failed: ${response.status} - ${errorText}`);
        }

        const analysisResult = await response.json();
        console.log("AI Analysis result received:", analysisResult);
        resultDiv.innerHTML = ""; // Clear loading message

        let analysisProperties = null;

        // Attempt to parse the analysis result from different possible structures
        if (Array.isArray(analysisResult) && analysisResult.length > 0 &&
            analysisResult[0] !== null && typeof analysisResult[0] === 'object' &&
            analysisResult[0].hasOwnProperty('output') &&
            analysisResult[0].output !== null && typeof analysisResult[0].output === 'object' &&
            analysisResult[0].output.hasOwnProperty('properties') &&
            analysisResult[0].output.properties !== null && typeof analysisResult[0].output.properties === 'object') {
            // Structure: [{ output: { properties: { ... } } }]
            analysisProperties = analysisResult[0].output.properties;
        }
        else if (typeof analysisResult === 'object' && analysisResult !== null &&
                 analysisResult.hasOwnProperty('summary') &&
                 analysisResult.hasOwnProperty('strengths') && Array.isArray(analysisResult.strengths) &&
                 analysisResult.hasOwnProperty('areas_for_concern') && Array.isArray(analysisResult.areas_for_concern) &&
                 analysisResult.hasOwnProperty('fit_score') &&
                 analysisResult.hasOwnProperty('hire_recommendation')) {
             // Structure: { summary: "...", strengths: [...], ... }
             // Convert to the expected properties structure
             analysisProperties = {
                 summary: { description: analysisResult.summary },
                 strengths: { description: analysisResult.strengths.join('\n') }, // Join array elements for display
                 areas_for_concern: { description: analysisResult.areas_for_concern.join('\n') }, // Join array elements
                 fit_score: { description: analysisResult.fit_score },
                 hire_recommendation: { description: analysisResult.hire_recommendation }
             };
         }
         else if (Array.isArray(analysisResult) && analysisResult.length > 0 && analysisResult[0] !== null && typeof analysisResult[0] === 'object' && analysisResult[0].hasOwnProperty('output') && typeof analysisResult[0].output === 'string') {
             // Structure: [{ output: "..." }] - Raw string output
             resultDiv.textContent = analysisResult[0].output;
             resultDiv.className = "ai-analysis-result";
             // Re-enable button and reset text
             buttonElement.disabled = false;
             buttonElement.innerHTML = `<i class="fas fa-robot mr-2"></i> Analyze Candidate Fit (AI)`;
             return; // Exit after displaying raw output
         }
         else if (typeof analysisResult === 'string') {
             // Structure: "..." - Raw string output
             resultDiv.textContent = analysisResult;
             resultDiv.className = "ai-analysis-result";
              // Re-enable button and reset text
             buttonElement.disabled = false;
             buttonElement.innerHTML = `<i class="fas fa-robot mr-2"></i> Analyze Candidate Fit (AI)`;
             return; // Exit after displaying raw output
         }


        if (analysisProperties) {
            resultDiv.className = "ai-analysis-result"; // Set initial class

            const createSection = (heading, content) => {
                const sectionDiv = document.createElement("div");
                sectionDiv.className = "section";
                const headingElement = document.createElement("h5");
                 // Format heading (e.g., "fit_score" becomes "Fit Score")
                const formattedHeading = heading.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                headingElement.textContent = formattedHeading + ":";
                sectionDiv.appendChild(headingElement);

                 // Check if content looks like a list (contains newlines or starts with '-')
                if (typeof content === 'string' && (content.includes('\n') || content.trim().startsWith('-'))) {
                    const items = content.split('\n').map(item => item.trim()).filter(item => item !== '');
                    if (items.length > 0) {
                        const ul = document.createElement("ul");
                        items.forEach(item => {
                            const li = document.createElement("li");
                             // Remove leading '- ' if present
                            li.textContent = item.startsWith('- ') ? item.substring(2) : item;
                            ul.appendChild(li);
                        });
                        sectionDiv.appendChild(ul);
                    } else {
                        const p = document.createElement("p");
                        p.textContent = "N/A";
                        sectionDiv.appendChild(p);
                    }
                } else {
                    const p = document.createElement("p");
                    p.textContent = content || "N/A"; // Display N/A if content is null/empty
                    sectionDiv.appendChild(p);
                }
                return sectionDiv;
            };

            // Render each property as a section
            for (const key in analysisProperties) {
                if (analysisProperties.hasOwnProperty(key) && analysisProperties[key] && analysisProperties[key].description !== undefined) { // Check if description exists
                    resultDiv.appendChild(createSection(key, analysisProperties[key].description));
                }
            }
            // If no properties were rendered, display a message
            if (resultDiv.innerHTML === "") {
                 resultDiv.innerHTML = "<p>AI analysis completed, but no specific properties were returned.</p>";
            }


        } else {
            console.error("Received AI analysis result in unexpected format:", analysisResult);
            resultDiv.innerHTML = "<p><i class='fas fa-exclamation-circle mr-2'></i> Error: Received AI analysis result in an unexpected format.</p>";
            resultDiv.className = "ai-analysis-result error";
        }
    } catch (error) {
        console.error("Error during AI analysis:", error);
        resultDiv.innerHTML = `<p><i class='fas fa-exclamation-circle mr-2'></i> Error during analysis: ${error.message}</p>`;
        resultDiv.className = "ai-analysis-result error";
    } finally {
        buttonElement.disabled = false;
         buttonElement.innerHTML = `<i class="fas fa-robot mr-2"></i> Analyze Candidate Fit (AI)`; // Reset button text and icon
    }
}


// Utility function to display status messages
function displayResultStatus(message, type) {
     const resultsDisplay = document.getElementById("resultsDisplay");
     if (!resultsDisplay) return;

     // Clear any existing status messages that are direct children of resultsDisplay
     const existingStatus = resultsDisplay.querySelector('.loading-message, .error-message, .no-results-message');
     if (existingStatus) {
         existingStatus.remove();
     }

     const statusElement = document.createElement("p");
     statusElement.className = type === 'loading' ? 'loading-message' : (type === 'error' ? 'error-message' : 'no-results-message'); // Use no-results for general info
     statusElement.innerText = message;

      // Add icons based on type
     if (type === 'loading') {
         statusElement.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${message}`;
     } else if (type === 'error') {
         statusElement.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i> ${message}`;
     } else { // For no-results or general info
          statusElement.innerHTML = `<i class="fas fa-info-circle mr-2"></i> ${message}`;
     }


     // Insert before the first submission block or append if none exist
     const firstSubmissionBlock = resultsDisplay.querySelector('.submission-block');
     if (firstSubmissionBlock) {
         resultsDisplay.insertBefore(statusElement, firstSubmissionBlock);
     } else {
         resultsDisplay.appendChild(statusElement);
     }

     // Optional: Automatically hide error messages after a few seconds
     if (type === 'error') {
         setTimeout(() => {
             statusElement.remove();
         }, 5000); // Remove after 5 seconds
     }
}
