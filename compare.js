// This script should be linked in compare.html using <script src="compare.js" defer></script>

// firebaseConfig is expected to be globally defined in compare.html <head>
let databaseURL = firebaseConfig.databaseURL;
let currentFormId = null;
let allSubmissionsData = []; // Store all fetched submissions data
let allCandidateAnalyses = []; // Store all fetched/generated AI analysis results

// Initialize Firebase App (This block is already in compare.html, no need to repeat here)
// if (!firebase.apps.length) {
//     try {
//          firebase.initializeApp(firebaseConfig);
// console.log("Firebase App initialized successfully from compare.js.");
//     } catch (error) {
// console.error("Error initializing Firebase App from compare.js:", error);
// updateStatusMessage(`Error initializing Firebase: ${error.message}. Check console.`, 'error', 'errorMessage');
//     }
// } else {
//     firebase.app();
// console.log("Firebase App already initialized (checked from compare.js).");
// }

document.addEventListener('DOMContentLoaded', async () => {
    const formNameTitleEl = document.getElementById('formNameTitleCompare');
    const aiAnalysisStatusEl = document.getElementById('aiAnalysisStatus');
    const overallRankingSectionEl = document.getElementById('overallRankingSection');
    const rankingContainerEl = document.getElementById('rankingContainer');
    const candidateCardsContainerEl = document.getElementById('candidateComparisonCards');

    const rawComparisonTableContainerEl = document.getElementById('rawComparisonTableContainer');
    const comparisonTableHeadEl = document.querySelector('#comparisonTable thead');
    const comparisonTableBodyEl = document.querySelector('#comparisonTable tbody');

    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage'); // Get error message element
    const noSubmissionsMessageEl = document.getElementById('noSubmissionsMessage');
    const triggerAIAnalysisButton = document.getElementById('triggerAIAnalysisButton');
    const customInstructionsTextarea = document.getElementById('customInstructions');
    const clearCustomInstructionsButton = document.getElementById('clearCustomInstructionsButton'); // Get the clear button


    // Download Dropdown Elements
    const rawDownloadDropdownButton = document.querySelector('.raw-download-dropdown .download-dropdown-button');
    const rawDownloadDropdownMenu = document.querySelector('.raw-download-dropdown .dropdown-menu');
    const aiDownloadDropdownButton = document.querySelector('.ai-download-dropdown .download-dropdown-button');
    const aiDownloadDropdownMenu = document.querySelector('.ai-download-dropdown .dropdown-menu');


    // Filter Controls (Placeholder for future implementation)
    // const candidateSearchInput = document.getElementById('candidateSearch');
    // const fitScoreFilterSelect = document.getElementById('fitScoreFilter');


    const urlParams = new URLSearchParams(window.location.search);
    currentFormId = urlParams.get('formId');

    console.log("Current Form ID from URL:", currentFormId);

    if (!currentFormId) {
        updateStatusMessage("<i class='fas fa-exclamation-circle mr-2'></i> Error: No Form ID Provided in URL.", 'error', 'errorMessage', formNameTitleEl);
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (triggerAIAnalysisButton) triggerAIAnalysisButton.disabled = true;
        if (rawDownloadDropdownButton) rawDownloadDropdownButton.disabled = true;
        if (aiDownloadDropdownButton) aiDownloadDropdownButton.disabled = true;
        return;
    }

    if (!databaseURL || databaseURL.includes("YOUR_FIREBASE_REALTIME_DATABASE_URL")) { // Check against placeholder
        updateStatusMessage("Firebase Database URL is not configured. Check firebaseConfig.", 'error', 'errorMessage', formNameTitleEl);
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (triggerAIAnalysisButton) triggerAIAnalysisButton.disabled = true;
        if (rawDownloadDropdownButton) rawDownloadDropdownButton.disabled = true;
        if (aiDownloadDropdownButton) aiDownloadDropdownButton.disabled = true;
        return;
    }

    let formStructureData = null;

    try {
        // 1. Fetch Form Structure
        updateStatusMessage("<i class='fas fa-spinner fa-spin mr-2'></i> Fetching form structure...", 'loading', 'loadingMessage');
        const formStructureResponse = await fetch(`${databaseURL}/forms/${currentFormId}.json`);
        if (!formStructureResponse.ok) {
             const errorText = await formStructureResponse.text();
             throw new Error(`Failed to fetch form structure: ${formStructureResponse.status} - ${errorText}`);
        }
        formStructureData = await formStructureResponse.json();
        if (!formStructureData || !formStructureData.name || !Array.isArray(formStructureData.questions)) {
            throw new Error("Invalid or incomplete form structure data received.");
        }
        if (formNameTitleEl) formNameTitleEl.textContent = `Comparison for: ${formStructureData.name}`;
        updateStatusMessage("Form structure fetched.", 'info', 'loadingMessage', null, true); // Clear after fetching


        // 2. Fetch Submissions
        updateStatusMessage("<i class='fas fa-spinner fa-spin mr-2'></i> Fetching submissions...", 'loading', 'loadingMessage');
        // CORRECTED FETCH PATH: Fetch directly from the formSubmissions node
        const submissionsResponse = await fetch(`${databaseURL}/formSubmissions/${currentFormId}.json`);
        if (!submissionsResponse.ok) {
             const errorText = await submissionsResponse.text();
             throw new Error(`Failed to fetch submissions: ${submissionsResponse.status} - ${errorText}`);
        }
        const submissionsRaw = await submissionsResponse.json();

        if (!submissionsRaw || Object.keys(submissionsRaw).length === 0) {
            if (loadingMessageEl) loadingMessageEl.style.display = 'none';
            if (noSubmissionsMessageEl) noSubmissionsMessageEl.style.display = 'block';
            if (formNameTitleEl) formNameTitleEl.textContent += " (No Submissions)";
            if (triggerAIAnalysisButton) triggerAIAnalysisButton.disabled = true;
             // Disable download buttons if no submissions
            if (rawDownloadDropdownButton) rawDownloadDropdownButton.disabled = true;
            if (aiDownloadDropdownButton) aiDownloadDropdownButton.disabled = true;
            return;
        }

        // Convert submissions object to an array, adding submissionId
        allSubmissionsData = Object.entries(submissionsRaw).map(([id, data]) => ({ submissionId: id, ...data }))
            .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()); // Sort by timestamp

        updateStatusMessage("Data fetched. Ready for AI Analysis.", 'success', 'loadingMessage', null, true); // Clear after fetching


        // Display raw comparison table immediately
        displayRawComparisonTable(formStructureData.questions, allSubmissionsData, comparisonTableHeadEl, comparisonTableBodyEl);
        if (rawComparisonTableContainerEl) rawComparisonTableContainerEl.style.display = 'block';

        // Enable raw data download button
        if (rawDownloadDropdownButton) rawDownloadDropdownButton.disabled = false;


        // Enable AI analysis trigger if submissions are found
        if (triggerAIAnalysisButton) triggerAIAnalysisButton.disabled = false;


        // --- Add event listeners for dropdown buttons ---
        if (rawDownloadDropdownButton) {
            rawDownloadDropdownButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent click from closing immediately
                toggleDropdown(rawDownloadDropdownMenu);
            });
        }
        if (aiDownloadDropdownButton) {
            aiDownloadDropdownButton.addEventListener('click', (event) => {
                 event.stopPropagation(); // Prevent click from closing immediately
                toggleDropdown(aiDownloadDropdownMenu);
            });
        }

        // --- Add event listeners for dropdown items ---
        document.querySelectorAll('.dropdown-menu .dropdown-item').forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault(); // Prevent default link behavior
                const format = item.dataset.format;
                const type = item.dataset.type; // 'raw' or 'ai'

                if (type === 'raw') {
                    downloadRawData(format);
                } else if (type === 'ai') {
                    downloadAIAnalysisReport(format);
                }

                closeAllDropdowns(); // Close dropdown after selection
            });
        });

        // --- Close dropdowns when clicking outside ---
        document.addEventListener('click', (event) => {
             // Check if the click was outside any dropdown container
             const isClickInsideDropdown = event.target.closest('.download-dropdown-container');
             if (!isClickInsideDropdown) {
                  closeAllDropdowns();
             }
        });


        // --- Add event listener for Clear Instructions button ---
        if (clearCustomInstructionsButton && customInstructionsTextarea) {
            clearCustomInstructionsButton.addEventListener('click', () => {
                customInstructionsTextarea.value = '';
            });
        }


    } catch (err) {
        console.error("Error fetching initial data:", err);
        updateStatusMessage(`<i class='fas fa-exclamation-circle mr-2'></i> Error fetching data: ${err.message}`, 'error', 'errorMessage', formNameTitleEl);
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (triggerAIAnalysisButton) triggerAIAnalysisButton.disabled = true;
        if (rawDownloadDropdownButton) rawDownloadDropdownButton.disabled = true;
        if (aiDownloadDropdownButton) aiDownloadDropdownButton.disabled = true;
    }

    // --- Add event listener for AI Analysis Button ---
    if (triggerAIAnalysisButton) {
        triggerAIAnalysisButton.addEventListener('click', async () => {
            if (!formStructureData || allSubmissionsData.length === 0) {
                updateStatusMessage("<i class='fas fa-exclamation-circle mr-2'></i> Cannot analyze: Form data or submissions are missing.", 'error', 'aiAnalysisStatus');
                return;
            }

            updateStatusMessage("<i class='fas fa-spinner fa-spin mr-2'></i> Sending data to AI for analysis... This may take a moment.", 'loading', 'aiAnalysisStatus');
            triggerAIAnalysisButton.disabled = true;
            const customInstructions = customInstructionsTextarea ? customInstructionsTextarea.value : "";

            try {
                const response = await fetch('/analyze-candidates', { // Calls your server.js endpoint
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        formId: currentFormId,
                        formStructure: formStructureData,
                        submissionsArray: allSubmissionsData, // Use the stored submissions data
                        customInstructions: customInstructions
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: "Unknown error from server", details: response.statusText }));
                    throw new Error(`AI Analysis request failed: ${errorData.error || response.statusText}. ${errorData.details || ''}`);
                }

                const analysisResult = await response.json();

                if (analysisResult.error) {
                    throw new Error(`AI Analysis Error: ${analysisResult.error}. ${analysisResult.details || ''}`);
                }

                console.log("AI Analysis Received:", analysisResult);

                // Store the analysis result
                allCandidateAnalyses = analysisResult.candidateAnalyses || [];

                updateStatusMessage("<i class='fas fa-check-circle mr-2'></i> AI Analysis Complete!", 'success', 'aiAnalysisStatus');

                // Display the AI analysis results (ranking and cards)
                displayAIAnalysis(allCandidateAnalyses, candidateCardsContainerEl, rankingContainerEl, overallRankingSectionEl);

                // Enable AI analysis download button
                if (aiDownloadDropdownButton) aiDownloadDropdownButton.disabled = false;


            } catch (err) {
                console.error("Error during AI analysis request:", err);
                updateStatusMessage(`<i class='fas fa-exclamation-circle mr-2'></i> AI Analysis Failed: ${err.message}`, 'error', 'aiAnalysisStatus');
                 // Disable AI analysis download button on error
                if (aiDownloadDropdownButton) aiDownloadDropdownButton.disabled = true;
            } finally {
                triggerAIAnalysisButton.disabled = false;
                 triggerAIAnalysisButton.innerHTML = `<i class="fas fa-brain mr-2"></i> Analyze Candidates with AI`; // Reset button text and icon
            }
        });
         // Add icon to the initial button text
         if (triggerAIAnalysisButton) triggerAIAnalysisButton.innerHTML = `<i class="fas fa-brain mr-2"></i> Analyze Candidates with AI`;
    }
});

/**
 * Toggles the display of a dropdown menu.
 * @param {HTMLElement} menuElement - The dropdown menu element.
 */
function toggleDropdown(menuElement) {
    // Close all other dropdowns first
    closeAllDropdowns(menuElement);
    // Toggle the 'show' class on the target menu
    if (menuElement) {
        menuElement.classList.toggle('show');
    }
}

/**
 * Closes all dropdown menus, except optionally one.
 * @param {HTMLElement} [exceptMenu=null] - Optional: A dropdown menu to exclude from closing.
 */
function closeAllDropdowns(exceptMenu = null) {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== exceptMenu) {
            menu.classList.remove('show');
        }
    });
}


/**
 * Updates a status message element on the page.
 * @param {string} message - The message to display.
 * @param {'info' | 'loading' | 'success' | 'error'} type - The type of message (influences styling).
 * @param {string} elementId - The ID of the HTML element to update.
 * @param {HTMLElement} [titleElement=null] - Optional: An element (like the title) to update on error.
 * @param {boolean} [hideAfter=false] - Optional: Whether to hide the message element after updating.
 */
function updateStatusMessage(message, type = 'info', elementId, titleElement = null, hideAfter = false) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = message; // Use innerHTML to allow icons
        el.className = `status-message ${type}`; // Ensure base class + type class
        el.style.display = 'block'; // Ensure it's visible

        // Hide other status messages if this one is prominent (error, success, info)
        if (type === 'error' || type === 'success' || type === 'info') {
            const loadingEl = document.getElementById('loadingMessage');
            const errorEl = document.getElementById('errorMessage');
            const noSubmissionsEl = document.getElementById('noSubmissionsMessage');
             const aiAnalysisEl = document.getElementById('aiAnalysisStatus');

            if (loadingEl && elementId !== 'loadingMessage') loadingEl.style.display = 'none';
            if (errorEl && elementId !== 'errorMessage') errorEl.style.display = 'none';
            if (noSubmissionsEl && elementId !== 'noSubmissionsMessage') noSubmissionsEl.style.display = 'none';
             // Don't hide aiAnalysisStatus if it's the element being updated
             if (aiAnalysisEl && elementId !== 'aiAnalysisStatus') aiAnalysisEl.style.display = 'none';
        }

        if (hideAfter) {
             setTimeout(() => {
                 el.style.display = 'none';
             }, 3000); // Hide after 3 seconds
        }
    }
    if (titleElement && type === 'error') {
        titleElement.textContent = "Error";
    }
}


/**
 * Displays the raw question-answer comparison table.
 * @param {Array<object>} questions - Array of question objects from the form structure.
 * @param {Array<object>} submissions - Array of submission data objects.
 * @param {HTMLTableSectionElement} tableHeadEl - The <thead> element.
 * @param {HTMLTableSectionElement} tableBodyEl - The <tbody> element.
 */
function displayRawComparisonTable(questions, submissions, tableHeadEl, tableBodyEl) {
    if (!tableHeadEl || !tableBodyEl || !questions || !submissions || submissions.length === 0) {
        if (tableHeadEl) tableHeadEl.innerHTML = '';
        if (tableBodyEl) tableBodyEl.innerHTML = '';
        console.warn("No data to display raw comparison table.");
        return;
    }

    tableHeadEl.innerHTML = "";
    const headerRow = tableHeadEl.insertRow();
    const questionHeader = document.createElement('th');
    questionHeader.textContent = "Question";
    questionHeader.className = "question-column"; // Apply class for styling
    headerRow.appendChild(questionHeader);

    // Add headers for each candidate
    submissions.forEach((sub, index) => {
        const th = document.createElement('th');
        // Use candidate alias if available, otherwise default
        th.textContent = sub.candidateAlias || `Candidate ${index + 1} (${new Date(sub.submittedAt).toLocaleDateString()})`;
        headerRow.appendChild(th);
    });

    tableBodyEl.innerHTML = "";

    // Populate table rows with answers
    questions.forEach(question => {
        const row = tableBodyEl.insertRow();
        const questionCell = row.insertCell();
        questionCell.textContent = question.text;
        questionCell.className = "question-column"; // Apply class for styling

        submissions.forEach(submission => {
            const answerCell = row.insertCell();
            // Find the response for this question in the current submission
            const response = submission.responses.find(r => r.questionId === question.id || r.questionText === question.text);

            if (response && response.answer !== null && response.answer !== undefined && response.answer !== "") {
                let answerContent = response.answer;
                if (Array.isArray(answerContent)) {
                     // Handle array answers (e.g., checkboxes) by creating a list
                    if (answerContent.length > 0) {
                        const ul = document.createElement('ul');
                        answerContent.forEach(item => { const li = document.createElement('li'); li.textContent = item; ul.appendChild(li); });
                        answerCell.appendChild(ul);
                    } else {
                         answerCell.innerHTML = "<i>No answer</i>"; // Indicate empty array response
                         answerCell.classList.add("no-answer");
                    }
                } else if (typeof answerContent === 'string' && (answerContent.startsWith('http://') || answerContent.startsWith('https://'))) {
                     // Make file URLs clickable links
                    const a = document.createElement('a');
                    a.href = answerContent;
                    a.textContent = "View File"; // Or just the URL
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    answerCell.appendChild(a);
                    answerCell.classList.add("answer-file");
                } else {
                     // Display simple text answer
                    answerCell.textContent = answerContent;
                }
            } else {
                 // Handle no answer, null, undefined, or empty string answers
                answerCell.innerHTML = "<i>No answer</i>"; // Indicate no answer
                answerCell.classList.add("no-answer");
            }
        });
    });
}


/**
 * Displays the AI analysis results (ranking and individual cards).
 * @param {Array<object>} candidateAnalyses - Array of AI analysis results for each candidate.
 * @param {HTMLElement} cardsContainerEl - The container for candidate cards.
 * @param {HTMLElement} rankingContainerEl - The container for the overall ranking.
 * @param {HTMLElement} overallRankingSectionEl - The section containing the ranking.
 */
function displayAIAnalysis(candidateAnalyses, cardsContainerEl, rankingContainerEl, overallRankingSectionEl) {
    // Check if the main candidate comparison section should be displayed
     const candidateComparisonSectionEl = document.getElementById('candidateComparisonSection');
     if(candidateComparisonSectionEl) candidateComparisonSectionEl.style.display = 'block';


    if (!cardsContainerEl || !rankingContainerEl || !candidateAnalyses || candidateAnalyses.length === 0) {
        cardsContainerEl.innerHTML = "<p>No AI analysis data to display.</p>";
        if(overallRankingSectionEl) overallRankingSectionEl.style.display = 'none'; // Hide ranking if no data
        return;
    }

    cardsContainerEl.innerHTML = ""; // Clear previous cards
    rankingContainerEl.innerHTML = ""; // Clear previous ranking

    // Sort candidates by overallFitScore (descending) for ranking
    const rankedCandidates = [...candidateAnalyses].sort((a, b) => (b.overallFitScore || 0) - (a.overallFitScore || 0));

    rankedCandidates.forEach((analysis, index) => {
        // Display Ranking Item
        const rankItem = document.createElement('div');
        rankItem.className = 'ranked-candidate';
        rankItem.innerHTML = `
            <span class="rank-position">${index + 1}.</span>
            <span class="rank-name">${analysis.candidateAlias || `Candidate (ID: ${analysis.submissionId.substring(0,6)}...)`}</span>
            <span class="rank-score">Overall Fit: ${analysis.overallFitScore || 'N/A'}/10</span>
        `;
        rankingContainerEl.appendChild(rankItem);

        // Display Candidate Card
        const card = document.createElement('div');
        card.className = 'candidate-card';

        let fitScoreClass = '';
        if (analysis.overallFitScore >= 8) fitScoreClass = 'high';
        else if (analysis.overallFitScore >= 5) fitScoreClass = 'medium';
        else if (analysis.overallFitScore > 0) fitScoreClass = 'low';


        let strengthsHTML = '<h5><i class="fas fa-plus-circle mr-1"></i> Strengths:</h5><p>None listed.</p>';
        if (analysis.strengths && Array.isArray(analysis.strengths) && analysis.strengths.length > 0) {
            strengthsHTML = `<h5><i class="fas fa-plus-circle mr-1"></i> Strengths:</h5><ul>${analysis.strengths.map(s => `<li>${s}</li>`).join('')}</ul>`;
        } else if (analysis.strengths && typeof analysis.strengths === 'string') {
             // Handle case where strengths might come as a single string
             strengthsHTML = `<h5><i class="fas fa-plus-circle mr-1"></i> Strengths:</h5><p>${analysis.strengths}</p>`;
        }


        let weaknessesHTML = '<h5><i class="fas fa-minus-circle mr-1"></i> Weaknesses/Concerns:</h5><p>None listed.</p>';
        if (analysis.weaknesses && Array.isArray(analysis.weaknesses) && analysis.weaknesses.length > 0) {
            weaknessesHTML = `<h5><i class="fas fa-minus-circle mr-1"></i> Weaknesses/Concerns:</h5><ul>${analysis.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>`;
        } else if (analysis.weaknesses && typeof analysis.weaknesses === 'string') {
             // Handle case where weaknesses might come as a single string
             weaknessesHTML = `<h5><i class="fas fa-minus-circle mr-1"></i> Weaknesses/Concerns:</h5><p>${analysis.weaknesses}</p>`;
        }


        let categoryScoresHTML = '<h5><i class="fas fa-chart-bar mr-1"></i> Category Scores:</h5><p>No category scores available.</p>';
        if (analysis.categoryScores && typeof analysis.categoryScores === 'object' && Object.keys(analysis.categoryScores).length > 0) {
            categoryScoresHTML = '<h5><i class="fas fa-chart-bar mr-1"></i> Category Scores:</h5><ul>';
            for (const [category, score] of Object.entries(analysis.categoryScores)) {
                // Ensure score is displayed nicely, allow 'N/A' if not a number
                const displayScore = typeof score === 'number' ? `${score}/10` : (score || 'N/A');
                categoryScoresHTML += `<li class="category-score-item"><span>${category}:</span> <span class="score">${displayScore}</span></li>`;
            }
            categoryScoresHTML += '</ul>';
        }

         // Added check for flag reason if flagged
         const flaggedHTML = analysis.isFlagged ?
             `<div class="flagged"><i class="fas fa-flag mr-1"></i> FLAGGED</div><div class="flagged-reason">${analysis.flagReason || 'No specific reason provided for flag.'}</div>` :
             '';


        card.innerHTML = `
            <h4>${analysis.candidateAlias || `Candidate (ID: ${analysis.submissionId.substring(0,6)}...)`}</h4>
            <p class="submission-time">Submitted: ${new Date(analysis.submittedAt).toLocaleString()}</p>

            <div class="ai-summary">
                <h5><i class="fas fa-clipboard-list mr-1"></i> Overall Summary:</h5>
                <p>${analysis.summary || 'No summary provided.'}</p>
            </div>

            <div class="ai-fit-score">
                <h5><i class="fas fa-star mr-1"></i> Overall Fit Score:</h5>
                <p><span class="fit-score-value ${fitScoreClass}">${analysis.overallFitScore || 'N/A'}</span>/10</p>
                <p><em>${analysis.fitReasoning || 'No reasoning provided.'}</em></p>
            </div>

            <div class="ai-category-scores">
                ${categoryScoresHTML}
            </div>

            <div class="ai-strengths">
                ${strengthsHTML}
            </div>
            <div class="ai-weaknesses">
                ${weaknessesHTML}
            </div>
            ${flaggedHTML}
        `;
        cardsContainerEl.appendChild(card);
    });
    if(overallRankingSectionEl) overallRankingSectionEl.style.display = 'block'; // Show ranking section
}


/**
 * Generates and downloads raw submission data.
 * @param {'csv' | 'json'} format - The desired download format.
 */
function downloadRawData(format) {
    console.log("Attempting to download raw data in format:", format);
    if (!allSubmissionsData || allSubmissionsData.length === 0) {
        alert("No raw data available to download.");
        console.warn("Download raw data failed: allSubmissionsData is empty.");
        return;
    }

    let dataString = "";
    let mimeType = "";
    const filename = `raw_submissions_${currentFormId || 'form'}.${format}`;

    if (format === 'json') {
        try {
            dataString = JSON.stringify(allSubmissionsData, null, 2); // Pretty print JSON
            mimeType = 'application/json';
             console.log("Generated Raw JSON:", dataString.substring(0, 200) + '...');
        } catch (error) {
            console.error("Error generating Raw JSON:", error);
            alert("Error generating Raw JSON for download.");
            return;
        }
    } else if (format === 'csv') {
        try {
            // Generate CSV header (Questions + Submission ID, Timestamp, Form ID)
            // Get question texts from form structure for consistent header order
            // Using responses from the first submission assumes all submissions have same questions in same order.
            // A more robust approach would be to use the formStructureData questions array.
            const questionTexts = allSubmissionsData[0].responses.map(r => r.questionText);

            // Build CSV header row
            const headerRow = ["Submission ID", "Submitted At", "Form ID", ...questionTexts];
            dataString += headerRow.map(header => `"${String(header).replace(/"/g, '""')}"`).join(',') + '\n'; // Ensure header is string and escaped

            // Build CSV data rows
            allSubmissionsData.forEach(submission => {
                const rowData = [
                    submission.submissionId || '',
                    submission.submittedAt || '',
                    submission.formId || '',
                ];

                // Add answers matching the question order in the header
                // Use the questionTexts array to ensure order
                questionTexts.forEach(questionText => {
                     // Find the response for this question in the current submission
                    const response = submission.responses.find(r => r.questionText === questionText);
                    let answer = "";
                    if (response && response.answer !== null && response.answer !== undefined) {
                        if (Array.isArray(response.answer)) {
                             // Join array elements for CSV
                            answer = response.answer.join('; '); // Use semicolon to separate options in a cell
                        } else if (typeof response.answer === 'string') {
                             answer = response.answer;
                        } else {
                             answer = String(response.answer); // Convert other types to string
                        }
                    }
                     // Escape double quotes within the cell and wrap in double quotes
                     rowData.push(`"${String(answer).replace(/"/g, '""')}"`); // Ensure cell data is string and escaped
                });
                dataString += rowData.join(',') + '\n';
            });
            mimeType = 'text/csv';
             console.log("Generated Raw CSV (first 200 chars):", dataString.substring(0, 200) + '...');
        } catch (error) {
            console.error("Error generating Raw CSV:", error);
            alert("Error generating Raw CSV for download.");
            return;
        }
    } else {
        console.error("Unsupported download format:", format);
        alert(`Unsupported download format: ${format}`);
        return;
    }

    // Trigger download
    try {
        const blob = new Blob([dataString], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a); // Append to body to make it clickable
        a.click(); // Trigger click
        document.body.removeChild(a); // Clean up
        URL.revokeObjectURL(url); // Free up memory
         console.log("Download triggered for", filename);
    } catch (error) {
        console.error("Error triggering download:", error);
        alert("Error triggering download.");
    }
}

/**
 * Generates and downloads the AI analysis report data.
 * @param {'csv' | 'json'} format - The desired download format.
 */
function downloadAIAnalysisReport(format) {
    console.log("Attempting to download AI analysis report in format:", format);
    if (!allCandidateAnalyses || allCandidateAnalyses.length === 0) {
        alert("No AI analysis data available to download. Please run the AI analysis first.");
        console.warn("Download AI analysis failed: allCandidateAnalyses is empty.");
        return;
    }

    let dataString = "";
    let mimeType = "";
    const filename = `ai_analysis_report_${currentFormId || 'form'}.${format}`;

    if (format === 'json') {
        try {
            dataString = JSON.stringify(allCandidateAnalyses, null, 2); // Pretty print JSON
            mimeType = 'application/json';
             console.log("Generated AI JSON:", dataString.substring(0, 200) + '...');
        } catch (error) {
             console.error("Error generating AI JSON:", error);
             alert("Error generating AI JSON for download.");
             return;
        }
    } else if (format === 'csv') {
        try {
            // Generate CSV header
            const headerRow = [
                "Submission ID",
                "Candidate Alias",
                "Submitted At",
                "Overall Fit Score",
                "Fit Reasoning",
                "Summary",
                "Strengths", // Will join array elements
                "Weaknesses/Concerns", // Will join array elements
                "Category Scores", // Will stringify object
                "Flagged",
                "Flag Reason"
            ];
            dataString += headerRow.map(header => `"${String(header).replace(/"/g, '""')}"`).join(',') + '\n'; // Ensure header is string and escaped

            // Build CSV data rows
            allCandidateAnalyses.forEach(analysis => {
                const rowData = [
                    analysis.submissionId || '',
                    analysis.candidateAlias || '',
                    analysis.submittedAt || '',
                    (analysis.overallFitScore !== null && analysis.overallFitScore !== undefined ? analysis.overallFitScore : ''), // Handle N/A for score
                    analysis.fitReasoning || '',
                    analysis.summary || '',
                     // Join array elements for strengths and weaknesses
                    (analysis.strengths && Array.isArray(analysis.strengths) ? analysis.strengths.join('; ') : (analysis.strengths || '')), // Ensure string for non-array
                    (analysis.weaknesses && Array.isArray(analysis.weaknesses) ? analysis.weaknesses.join('; ') : (analysis.weaknesses || '')), // Ensure string for non-array
                     // Stringify category scores object, handle non-object case
                    (analysis.categoryScores && typeof analysis.categoryScores === 'object' ? JSON.stringify(analysis.categoryScores).replace(/"/g, '""') : String(analysis.categoryScores || '').replace(/"/g, '""')), // Ensure string and escape internal quotes
                    analysis.isFlagged ? 'Yes' : 'No',
                    analysis.flagReason || ''
                ];
                 // Escape double quotes within the cell and wrap in double quotes
                dataString += rowData.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
            });
            mimeType = 'text/csv';
            console.log("Generated AI CSV (first 200 chars):", dataString.substring(0, 200) + '...');
        } catch (error) {
            console.error("Error generating AI CSV:", error);
            alert("Error generating AI CSV for download.");
            return;
        }
    } else {
        console.error("Unsupported download format:", format);
        alert(`Unsupported download format: ${format}`);
        return;
    }

    // Trigger download
    try {
        const blob = new Blob([dataString], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a); // Append to body
        a.click(); // Trigger click
        document.body.removeChild(a); // Clean up
        URL.revokeObjectURL(url); // Free up memory
        console.log("Download triggered for", filename);
    } catch (error) {
        console.error("Error triggering download:", error);
        alert("Error triggering download.");
    }
}


// --- Placeholder for Filtering Logic (Optional Future Feature) ---
// function applyFilters() {
//     // Implement filtering logic based on search input and fit score select
//     // Filter allSubmissionsData and allCandidateAnalyses
//     // Then re-render the display using displayRawComparisonTable and displayAIAnalysis
//     console.log("Filtering not yet implemented.");
// }
//
// if(candidateSearchInput) {
//     candidateSearchInput.addEventListener('input', applyFilters);
// }
// if(fitScoreFilterSelect) {
//     fitScoreFilterSelect.addEventListener('change', applyFilters);
// }
