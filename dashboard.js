// dashboard.js - Handles Dashboard functionality

document.addEventListener('DOMContentLoaded', () => {
    console.log("dashboard.js: DOMContentLoaded.");

    if (!firebase || typeof firebase.auth !== 'function' || typeof firebase.database !== 'function') {
        console.error("dashboard.js: Firebase SDKs not properly initialized.");
        // Error display handled by HTML/auth.js ideally
        // Find and update a status element if possible
        const mainContentArea = document.getElementById('mainContent');
        if (mainContentArea) {
            mainContentArea.innerHTML = '<p class="status-message error"><i class="fas fa-exclamation-circle mr-2"></i> Application critical error: Firebase SDKs failed to load. Check console for details.</p>';
        }
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.classList.remove('show');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.database();

    const loadingOverlay = document.getElementById('loadingOverlay');
    const mainContentArea = document.getElementById('mainContent');
    const pageTitleEl = document.getElementById('pageTitle');
    const dashboardSections = document.querySelectorAll('.dashboard-section');

    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
    const navButtons = document.querySelectorAll('.nav-btn');

    const formsCreatedCountEl = document.getElementById('formsCreatedCount');
    const totalResponsesCountEl = document.getElementById('totalResponsesCount');
    const newThisWeekCountEl = document.getElementById('newThisWeekCount');
    const userPlanEl = document.getElementById('userPlan');
    const planButton = document.getElementById('planButton');
    const userFormsListEl = document.getElementById('userFormsList');

    // Stats Section Elements
    const statsSectionHeadingEl = document.getElementById('statsSectionHeading');
    const statsIntroTextEl = document.getElementById('statsIntroText');
    const generalStatsChartContainerEl = document.getElementById('generalStatsChartContainer');
    const formSpecificStatsContainerEl = document.getElementById('formSpecificStatsContainer');

    const responsesChartCanvas = document.getElementById('responsesChart'); // For general / simple selected form bar
    const responsesOverTimeChartCanvas = document.getElementById('responsesOverTimeChart');
    const answerDistributionChartCanvas = document.getElementById('answerDistributionChart');
    const statsQuestionSelectEl = document.getElementById('statsQuestionSelect');
    const responsesOverTimeMessageEl = document.getElementById('responsesOverTimeMessage');
    const answerDistributionMessageEl = document.getElementById('answerDistributionMessage');


    let responsesChart = null; // Chart for general stats
    let responsesOverTimeChart = null; // Chart for specific form responses over time
    let answerDistributionChart = null; // Chart for specific question answer distribution

    let currentUser = null;
    let allUserForms = []; // Holds metadata like { formId, name, createdAt, submissionCount }
    let formQuestionsCache = {}; // Cache for questions of a specific form { formId: [questions] }
    let formSubmissionsCache = {}; // Cache for submissions of a specific form { formId: [submissions] }
    let userFormsListener = null; // Listener for user's forms metadata
    let currentFormStatsListener = null; // Listener for submissions of the currently viewed form
    let currentFormStatsListenerRef = null; // Store the ref for the specific form listener to detach it


    function showSection(sectionId) {
        console.log("dashboard.js: Showing section:", sectionId);
        let sectionTitle = "Dashboard";
        dashboardSections.forEach(section => {
            const isTargetSection = section.id === sectionId;
            section.classList.toggle('hidden', !isTargetSection);
            if (isTargetSection) {
                sectionTitle = section.querySelector('.section-heading')?.textContent || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
            }
        });
        if (pageTitleEl) pageTitleEl.textContent = sectionTitle;
        navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.section === sectionId));
        if (mainContentArea) mainContentArea.scrollTop = 0;

        // Control visibility of stats containers
        if (sectionId === 'stats') {
            // When navigating to the stats section, initially show the general stats
            generalStatsChartContainerEl.classList.remove('hidden');
            formSpecificStatsContainerEl.classList.add('hidden');
            statsQuestionSelectEl.style.display = 'none';
            statsQuestionSelectEl.innerHTML = ''; // Clear previous options
            // Render the general stats chart immediately
            renderGeneralStatsChart();
             // Add a slight delay before resizing to ensure container is visible and sized
             // This is particularly important if the stats section was display: none
             setTimeout(() => {
                 if (responsesChart) {
                     responsesChart.resize();
                     console.log("dashboard.js: Resized general stats chart after showing section.");
                 }
             }, 50); // Adjust delay if needed
        } else {
             // When navigating away from stats, detach specific form stats listener and destroy charts
             detachCurrentFormStatsListener();
        }
    }

    function hideLoadingOverlay() {
        if (loadingOverlay) loadingOverlay.classList.remove('show');
    }

    async function fetchUserFormsAndInitDashboard() {
        console.log("dashboard.js: fetchUserFormsAndInitDashboard called.");
        if (!currentUser || !db) {
             console.error("dashboard.js: currentUser or db not available.");
             hideLoadingOverlay();
             return;
        }
        if (!databaseURL || databaseURL.includes("YOUR_DATABASE_URL")) {
             console.error("dashboard.js: databaseURL not configured.");
             hideLoadingOverlay();
             return;
        }

        console.log("dashboard.js: User authenticated, proceeding to set up forms listener for user:", currentUser.uid);
        if (mainContentArea) mainContentArea.style.display = 'flex'; // Ensure main content is visible
        showSection('home'); // Default to home section on load

        if (userFormsListEl && !userFormsListEl.querySelector('.status-message.loading')) {
            userFormsListEl.innerHTML = '<p class="status-message loading dynamic"><i class="fas fa-spinner fa-spin mr-2"></i> Loading your forms...</p>';
        }

        const userId = currentUser.uid;
        // Listen to the user's forms metadata path
        const userFormsRef = db.ref(`users/${userId}/forms`);

        // Detach previous listener if it exists
        if (userFormsListener) {
             console.log("dashboard.js: Detaching previous userFormsListener.");
             userFormsRef.off('value', userFormsListener); // Detach using the ref and the stored listener function
        }


        // Attach the real-time listener
        userFormsListener = userFormsRef.on('value', (snapshot) => {
            console.log("dashboard.js: Real-time forms data received for user:", userId);
            const formsData = snapshot.val();

            // Process the data into the allUserForms array
            allUserForms = formsData ?
                Object.entries(formsData).map(([formId, formData]) => ({
                    formId,
                    // Ensure formData is an object before spreading
                    ...(typeof formData === 'object' && formData !== null ? formData : { name: 'Invalid Form Data', createdAt: new Date().toISOString(), submissionCount: 0 })
                }))
                // Sort by creation date, newest first
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                : [];

            console.log("dashboard.js: Processed allUserForms:", allUserForms);

            // Update the UI based on the new data
            renderUserFormsList(allUserForms);
            updateHomeStats(allUserForms);

            // If the user is currently on the 'Stats' section and viewing the general chart, redraw it
            const statsSection = document.getElementById('stats');
            if (statsSection && !statsSection.classList.contains('hidden') && generalStatsChartContainerEl && !generalStatsChartContainerEl.classList.contains('hidden')) {
                 console.log("dashboard.js: User is on general stats page, redrawing chart.");
                 renderGeneralStatsChart();
                 // Resize the chart after updating data
                 if (responsesChart) responsesChart.resize();
                 console.log("dashboard.js: Resized general stats chart after data update.");
            }

            hideLoadingOverlay(); // Hide loading overlay once initial data is loaded
        }, (error) => {
            console.error("dashboard.js: Error fetching user forms:", error);
            if (userFormsListEl) userFormsListEl.innerHTML = '<p class="status-message error"><i class="fas fa-exclamation-circle mr-2"></i> Error loading forms.</p>';
            hideLoadingOverlay(); // Hide loading overlay even on error
        });
    }

    // Function to detach the specific form stats listener
    function detachCurrentFormStatsListener() {
         if (currentFormStatsListener && currentFormStatsListenerRef) {
              console.log("dashboard.js: Detaching currentFormStatsListener.");
              currentFormStatsListenerRef.off('value', currentFormStatsListener); // Detach using the stored ref and listener function
              currentFormStatsListener = null;
              currentFormStatsListenerRef = null;
         }
         // Also destroy the charts
         if (responsesOverTimeChart) { responsesOverTimeChart.destroy(); responsesOverTimeChart = null; }
         if (answerDistributionChart) { answerDistributionChart.destroy(); answerDistributionChart = null; }
         if (statsQuestionSelectEl) { statsQuestionSelectEl.innerHTML = ''; statsQuestionSelectEl.style.display = 'none'; }
         if (responsesOverTimeMessageEl) responsesOverTimeMessageEl.textContent = "";
         if (answerDistributionMessageEl) answerDistributionMessageEl.textContent = "";
    }


    function renderUserFormsList(formsArray) {
        if (!userFormsListEl) return;
        userFormsListEl.innerHTML = ''; // Clear current list
        if (!formsArray || formsArray.length === 0) {
            userFormsListEl.innerHTML = '<p class="status-message info"><i class="fas fa-info-circle mr-2"></i> No forms yet. Create one!</p>';
            return;
        }
        formsArray.forEach(({ formId, name, createdAt, submissionCount }) => {
            const item = document.createElement('div');
            item.className = 'form-item';
            item.dataset.formId = formId;
            item.innerHTML = `
                <div class="form-details">
                    <div class="form-name">${name || 'Untitled Form'}</div>
                    <div class="form-meta">
                        Created: ${new Date(createdAt || Date.now()).toLocaleDateString()}
                        | Responses: <span class="submission-count">${submissionCount || 0}</span>
                    </div>
                </div>
                <div class="form-actions">
                    <a href="result.html?formId=${formId}" target="_blank" class="btn btn-secondary"><i class="fas fa-poll-h mr-1"></i> Results</a>
                    <a href="preview.html?formId=${formId}" target="_blank" class="btn btn-secondary"><i class="fas fa-external-link-alt mr-1"></i> Open</a>
                    <button class="btn btn-info view-form-stats"><i class="fas fa-chart-pie mr-1"></i> Stats</button>
                </div>`;
            // Attach event listener to the "Stats" button
            item.querySelector('.view-form-stats').addEventListener('click', () => navigateToFormStats(formId, name || 'Untitled Form'));
            userFormsListEl.appendChild(item);
        });
    }

    function updateHomeStats(formsArray) {
         const formsCount = formsArray.length;
         const totalResponses = formsArray.reduce((sum, form) => sum + (form.submissionCount || 0), 0);
         const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
         // This calculates new forms created this week. If you need new *responses* this week,
         // you'd need to track submission timestamps and aggregate them.
         const newFormsThisWeek = formsArray.filter(form => new Date(form.createdAt || 0).getTime() >= sevenDaysAgo).length;
         const currentPlan = currentUser?.plan || 'Free'; // Assuming user object has a 'plan' property

         if (formsCreatedCountEl) formsCreatedCountEl.textContent = formsCount;
         if (totalResponsesCountEl) totalResponsesCountEl.textContent = totalResponses;
         if (newThisWeekCountEl) newThisWeekCountEl.textContent = newFormsThisWeek;
         if (userPlanEl) userPlanEl.textContent = currentPlan;
         if (planButton) planButton.textContent = currentPlan + ' Plan';
         console.log("dashboard.js: Home stats updated:", { formsCount, totalResponses, newFormsThisWeek });
    }

    async function navigateToFormStats(formId, formName) {
        console.log(`dashboard.js: Navigating to stats for form: ${formName} (ID: ${formId})`);
        showSection('stats'); // This will also reset general/specific visibility initially

        // Hide general stats and show specific form stats area
        generalStatsChartContainerEl.classList.add('hidden');
        formSpecificStatsContainerEl.classList.remove('hidden');
        // Store the current form ID and name on the container for later use (e.g., by the question select listener)
        formSpecificStatsContainerEl.dataset.currentFormId = formId;
        formSpecificStatsContainerEl.dataset.currentFormName = formName;


        if (statsSectionHeadingEl) statsSectionHeadingEl.textContent = `Statistics for: ${formName}`;
        if (statsIntroTextEl) statsIntroTextEl.textContent = `Detailed statistics for your form "${formName}".`;

        // Detach any previous specific form stats listener
        detachCurrentFormStatsListener();

        // Fetch full form structure (questions) if not cached - needed for answer distribution
        if (!formQuestionsCache[formId]) {
            console.log(`dashboard.js: Fetching form structure for ${formId}...`);
            try {
                // Assuming global /forms path for full structure
                const formSnapshot = await db.ref(`/forms/${formId}`).once('value');
                const formData = formSnapshot.val();
                if (formData && formData.questions) {
                    formQuestionsCache[formId] = formData.questions;
                    console.log(`dashboard.js: Fetched form structure for ${formId}:`, formQuestionsCache[formId]);
                } else {
                    console.warn(`dashboard.js: No questions found for form ${formId} at /forms/${formId}`);
                    formQuestionsCache[formId] = [];
                }
            } catch (error) {
                console.error(`dashboard.js: Error fetching form structure for ${formId}:`, error);
                formQuestionsCache[formId] = [];
            }
        }

        // --- Set up Real-time Listener for Submissions for this specific form ---
        // This will update the charts automatically when new submissions arrive
        const formSubmissionsRef = db.ref(`/formSubmissions/${formId}`);
        currentFormStatsListenerRef = formSubmissionsRef; // Store the ref

        responsesOverTimeMessageEl.textContent = "Loading submission data...";
        answerDistributionMessageEl.textContent = "Loading submission data...";

        currentFormStatsListener = formSubmissionsRef.on('value', (snapshot) => {
             console.log(`dashboard.js: Real-time submissions data received for form: ${formId}`);
             const submissionsData = snapshot.val();
             formSubmissionsCache[formId] = submissionsData ? Object.values(submissionsData) : [];
             console.log(`dashboard.js: Processed ${formSubmissionsCache[formId].length} submissions for form ${formId}`);

             // Re-render charts with the new submission data
             renderResponsesOverTimeChart(formId, formName);
             populateStatsQuestionSelect(formId); // Repopulate dropdown in case questions changed (less likely)
             // Trigger render for the currently selected question in the distribution chart
             // Check if a question is already selected in the dropdown
             const selectedQuestionId = statsQuestionSelectEl ? statsQuestionSelectEl.value : null;
             if (selectedQuestionId) {
                 renderAnswerDistributionChart(formId, formName, selectedQuestionId);
             } else {
                  // If no question is selected or available, clear/show message
                  if(answerDistributionChart) answerDistributionChart.destroy();
                  answerDistributionMessageEl.textContent = "Select a question to see distribution.";
             }

             // Resize specific form charts after data update
             // Add a slight delay to ensure the DOM has updated before resizing
             setTimeout(() => {
                  if (responsesOverTimeChart) responsesOverTimeChart.resize();
                  if (answerDistributionChart) answerDistributionChart.resize();
                  console.log("dashboard.js: Resized specific form charts after data update.");
             }, 50); // Adjust delay if needed


        }, (error) => {
             console.error(`dashboard.js: Error fetching real-time submissions for ${formId}:`, error);
             responsesOverTimeMessageEl.textContent = "Could not load submission data.";
             answerDistributionMessageEl.textContent = "Could not load submission data.";
        });


        // Initial render of charts with the data fetched by the listener (or empty if no data yet)
        // The listener callback will handle subsequent updates.
        // We don't need to fetch submissions here with .once(), the listener does it.
        // Just call the render functions, they will use the data populated by the listener.
        renderResponsesOverTimeChart(formId, formName);
        populateStatsQuestionSelect(formId);
        if (statsQuestionSelectEl.options.length > 0) {
            renderAnswerDistributionChart(formId, formName, statsQuestionSelectEl.value);
        } else {
             if(answerDistributionChart) answerDistributionChart.destroy();
            answerDistributionMessageEl.textContent = "No suitable questions for distribution chart or no submissions.";
        }

         // Resize specific form charts after initial render
         // Add a slight delay to ensure the DOM has updated before resizing
         setTimeout(() => {
              if (responsesOverTimeChart) responsesOverTimeChart.resize();
              if (answerDistributionChart) answerDistributionChart.resize();
              console.log("dashboard.js: Resized specific form charts after initial render.");
         }, 50); // Adjust delay if needed
    }

    function renderResponsesOverTimeChart(formId, formName) {
        if (!responsesOverTimeChartCanvas) return;
        if (responsesOverTimeChart) responsesOverTimeChart.destroy(); // Destroy previous chart instance
        responsesOverTimeMessageEl.textContent = ""; // Clear previous messages


        const submissions = formSubmissionsCache[formId] || [];
        console.log(`dashboard.js: Rendering Responses Over Time chart for ${formName} with ${submissions.length} submissions.`);

        if (submissions.length === 0) {
            responsesOverTimeMessageEl.textContent = "No responses yet for this form to show trend over time.";
            return;
        }

        // Process submissions for time series data
        const responsesByDate = submissions.reduce((acc, sub) => {
            if (!sub.submittedAt) return acc;
            // Use the date part only for grouping
            const date = new Date(sub.submittedAt);
            // Format date to YYYY-MM-DD to ensure correct grouping regardless of timezone/time
            const dateKey = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`;
            acc[dateKey] = (acc[dateKey] || 0) + 1;
            return acc;
        }, {});

        // Convert to array of {x: Date, y: count} for Chart.js time scale
        const chartData = Object.entries(responsesByDate).map(([dateString, count]) => ({
             x: new Date(dateString), // Convert back to Date object for Chart.js time scale
             y: count
        })).sort((a, b) => a.x.getTime() - b.x.getTime()); // Sort by date


        if (chartData.length === 0) {
             responsesOverTimeMessageEl.textContent = "Not enough data to show responses over time.";
             return;
        }

        responsesOverTimeChart = new Chart(responsesOverTimeChartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                datasets: [{
                    label: `Responses for ${formName}`,
                    data: chartData, // Use the {x, y} data format
                    borderColor: '#00796b',
                    backgroundColor: 'rgba(0, 121, 107, 0.1)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time', // Use the time scale
                        time: {
                            unit: 'day', // Display unit
                            tooltipFormat: 'MMM dd, YYYY', // Tooltip format
                            displayFormats: {
                                day: 'MMM dd' // Display format on axis
                            }
                        },
                        title: { display: true, text: 'Date'}
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Number of Responses' },
                        ticks: {
                             // Ensure y-axis only shows whole numbers
                             callback: function(value) { if (value % 1 === 0) return value; }
                        }
                    }
                },
                plugins: { title: { display: true, text: `Daily Responses for ${formName}` } }
            }
        });
    }

    function populateStatsQuestionSelect(formId) {
        statsQuestionSelectEl.innerHTML = ''; // Clear previous options
        statsQuestionSelectEl.style.display = 'none';
        answerDistributionMessageEl.textContent = "";


        const questions = formQuestionsCache[formId] || [];
        // Types suitable for distribution charts (e.g., pie or bar)
        const suitableQuestionTypes = ['dropdown', 'multiple_choice', 'checkboxes', 'yes_no', 'rating'];

        const filteredQuestions = questions.filter(q => suitableQuestionTypes.includes(q.type));

        if (filteredQuestions.length === 0) {
            answerDistributionMessageEl.textContent = "No questions suitable for answer distribution chart (e.g., dropdown, multiple choice, rating).";
            return;
        }

        // Add a default option if needed, or just add the filtered questions
        // const defaultOption = document.createElement('option');
        // defaultOption.value = '';
        // defaultOption.textContent = '-- Select a Question --';
        // statsQuestionSelectEl.appendChild(defaultOption);


        filteredQuestions.forEach((q, index) => {
            const option = document.createElement('option');
            // Use question ID as value, fallback to index if ID is missing
            option.value = q.id || `q_index_${index}`;
             // Truncate long question text for the dropdown
            option.textContent = q.text.length > 60 ? q.text.substring(0, 60) + "..." : q.text;
            statsQuestionSelectEl.appendChild(option);
        });

        // Show the select element if there are options
        if (statsQuestionSelectEl.options.length > 0) {
             statsQuestionSelectEl.style.display = 'block';
        } else {
             answerDistributionMessageEl.textContent = "No suitable questions for answer distribution chart.";
        }
    }


    function renderAnswerDistributionChart(formId, formName, questionId) {
        if (!answerDistributionChartCanvas) return;
        if (answerDistributionChart) answerDistributionChart.destroy(); // Destroy previous chart instance
        answerDistributionMessageEl.textContent = ""; // Clear previous messages


        const submissions = formSubmissionsCache[formId] || [];
        const questions = formQuestionsCache[formId] || [];
        // Find the selected question by its ID (or fallback index ID)
        const selectedQuestion = questions.find(q => (q.id || `q_index_${questions.indexOf(q)}`) === questionId);


        if (!selectedQuestion) {
            answerDistributionMessageEl.textContent = "Selected question not found for analysis.";
            return;
        }
         console.log(`dashboard.js: Rendering Answer Distribution chart for "${selectedQuestion.text}" (ID: ${questionId}) with ${submissions.length} submissions.`);

        if (submissions.length === 0) {
            answerDistributionMessageEl.textContent = `No responses yet to show distribution for "${selectedQuestion.text}".`;
            return;
        }

        // Aggregate answers for the selected question
        const answerCounts = {};
        submissions.forEach(sub => {
            // Assuming sub.answers is an object where keys are question IDs (or text)
            // Or an array of { questionId: ..., answer: ... }
            // This part needs to match your submission data structure
            let answer;
            if (sub.responses && Array.isArray(sub.responses)) { // Assuming submission data has a 'responses' array
                // Try to find the answer by question ID first, then by text as fallback
                const ansObj = sub.responses.find(r => r.questionId === selectedQuestion.id || (selectedQuestion.text && r.questionText === selectedQuestion.text));
                answer = ansObj ? ansObj.answer : undefined;
            } else if (sub.answers && typeof sub.answers === 'object') { // Fallback to old 'answers' structure if needed
                 // Try to find the answer by question ID key first, then by text key as fallback
                 answer = sub.answers[selectedQuestion.id] || (selectedQuestion.text && sub.answers[selectedQuestion.text]);
            }


            if (answer !== undefined && answer !== null) {
                if (Array.isArray(answer)) { // For checkboxes, iterate through selected options
                    answer.forEach(a => {
                         const answerKey = String(a).trim(); // Use trimmed string as key
                         if (answerKey) answerCounts[answerKey] = (answerCounts[answerKey] || 0) + 1;
                    });
                } else { // For other types (dropdown, radio, rating)
                     const answerKey = String(answer).trim(); // Use trimmed string as key
                     if (answerKey) answerCounts[answerKey] = (answerCounts[answerKey] || 0) + 1;
                }
            }
        });

        const labels = Object.keys(answerCounts);
        const data = Object.values(answerCounts);

        if (labels.length === 0) {
            answerDistributionMessageEl.textContent = `No answers recorded for "${selectedQuestion.text}".`;
            return;
        }

        // Determine chart type based on number of options/answers
        let chartType = 'pie';
        if (labels.length > 10) chartType = 'bar'; // Switch to bar if too many slices/bars

        answerDistributionChart = new Chart(answerDistributionChartCanvas.getContext('2d'), {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: `Distribution for "${selectedQuestion.text.substring(0,30)}..."`,
                    data: data,
                    // Generate distinct colors
                    backgroundColor: labels.map((_, i) => `hsl(${i * (360 / Math.max(1, labels.length))}, 70%, 60%)`),
                    borderColor: '#ffffff', // White border for pie slices
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: `Answer Distribution: ${selectedQuestion.text}` },
                    legend: {
                         position: chartType === 'pie' ? 'right' : 'top', // Legend position
                    }
                },
                // Specific options for bar chart if needed
                scales: chartType === 'bar' ? {
                    x: { title: { display: true, text: 'Answer' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Count' }, ticks: { callback: function(value) { if (value % 1 === 0) return value; } } }
                } : {} // No scales for pie chart
            }
        });
    }


    function renderGeneralStatsChart() {
        console.log("dashboard.js: Rendering general stats chart.");
        if (!responsesChartCanvas) return;
        // Destroy previous chart instance if it exists
        if (responsesChart) responsesChart.destroy();

        // Ensure general stats container is visible and specific is hidden
        generalStatsChartContainerEl.classList.remove('hidden');
        formSpecificStatsContainerEl.classList.add('hidden');

        if (statsSectionHeadingEl) statsSectionHeadingEl.textContent = "Overall Statistics";
        if (statsIntroTextEl) statsIntroTextEl.textContent = "Overview of your form activity. Select a specific form to see its detailed stats.";

        if (!allUserForms || allUserForms.length === 0) {
            if (statsIntroTextEl) statsIntroTextEl.textContent = "No forms created yet. Create a form to see statistics.";
            responsesChartCanvas.style.display = 'none'; // Hide canvas if no data
            return;
        }
        responsesChartCanvas.style.display = 'block'; // Show canvas if data exists

        const formNames = allUserForms.map(f => f.name || 'Untitled');
        const responseCounts = allUserForms.map(f => f.submissionCount || 0);

        responsesChart = new Chart(responsesChartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: formNames,
                datasets: [{
                    label: 'Total Responses per Form',
                    data: responseCounts,
                    // Generate distinct colors for each bar
                    backgroundColor: formNames.map((_, i) => `hsla(${i * (360 / Math.max(1,formNames.length))}, 60%, 70%, 0.7)`),
                    borderColor: '#004d40', // Darker border
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                indexAxis: 'y', // Make it a horizontal bar chart
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: 'Total Responses' },
                        ticks: {
                             // Ensure x-axis only shows whole numbers
                             callback: function(value) { if (value % 1 === 0) return value; }
                        }
                    },
                    y: {
                         title: { display: true, text: 'Form Name' }
                    }
                },
                plugins: {
                    title: { display: true, text: 'Total Responses by Form' },
                    legend: { display: false } // Hide legend for simple bar chart
                }
            }
        });
    }


    // --- Event Listeners ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.dataset.section;
            showSection(sectionId);
            // Specific actions when navigating to sections
            if (sectionId === 'stats') {
                // showSection('stats') already calls renderGeneralStatsChart() and resizes
            } else if (sectionId === 'home') {
                updateHomeStats(allUserForms); // Ensure home stats are updated
            }
            // When navigating away from 'stats', detach the specific form listener
             if (sectionId !== 'stats') {
                 detachCurrentFormStatsListener();
             }
        });
    });

    if (collapseSidebarBtn && sidebar) {
         collapseSidebarBtn.addEventListener('click', () => {
              sidebar.classList.toggle('collapsed');
              // You might want to adjust main content margin here if sidebar is not fixed
              // Also resize charts if they are visible after collapse/expand
              // Add a slight delay to allow CSS transition to complete
              setTimeout(() => {
                   if (responsesChart && !generalStatsChartContainerEl.classList.contains('hidden')) responsesChart.resize();
                   if (responsesOverTimeChart && !formSpecificStatsContainerEl.classList.contains('hidden')) responsesOverTimeChart.resize();
                   if (answerDistributionChart && !formSpecificStatsContainerEl.classList.contains('hidden')) answerDistributionChart.resize();
                   console.log("dashboard.js: Resized charts after sidebar collapse/expand.");
              }, 350); // Delay slightly more than sidebar transition
         });
    }
    if (toggleSidebarBtn && sidebar) {
         toggleSidebarBtn.addEventListener('click', () => {
              sidebar.classList.toggle('show');
              // Resize charts after showing/hiding mobile sidebar
              // Add a slight delay to allow CSS transition to complete
              setTimeout(() => {
                   if (responsesChart && !generalStatsChartContainerEl.classList.contains('hidden')) responsesChart.resize();
                   if (responsesOverTimeChart && !formSpecificStatsContainerEl.classList.contains('hidden')) responsesOverTimeChart.resize();
                   if (answerDistributionChart && !formSpecificStatsContainerEl.classList.contains('hidden')) answerDistributionChart.resize();
                   console.log("dashboard.js: Resized charts after mobile sidebar toggle.");
              }, 350); // Delay slightly more than sidebar transition
         });
    }
    // Close mobile sidebar when clicking outside it on the main content area
    if (mainContentArea && sidebar) {
         mainContentArea.addEventListener('click', () => {
              if (sidebar.classList.contains('show')) {
                   sidebar.classList.remove('show');
                    // Resize charts after hiding mobile sidebar
                   // Add a slight delay to allow CSS transition to complete
                   setTimeout(() => {
                        if (responsesChart && !generalStatsChartContainerEl.classList.contains('hidden')) responsesChart.resize();
                        if (responsesOverTimeChart && !formSpecificStatsContainerEl.classList.contains('hidden')) responsesOverTimeChart.resize();
                        if (answerDistributionChart && !formSpecificStatsContainerEl.classList.contains('hidden')) answerDistributionChart.resize();
                        console.log("dashboard.js: Resized charts after clicking outside mobile sidebar.");
                   }, 350); // Delay slightly more than sidebar transition
              }
         });
    }

    // Listener for when a different question is selected in the stats section
    if (statsQuestionSelectEl) {
        statsQuestionSelectEl.addEventListener('change', (event) => {
            // Get the form ID and name from the container where they were stored
            const formId = formSpecificStatsContainerEl.dataset.currentFormId;
            const formName = formSpecificStatsContainerEl.dataset.currentFormName;
            const selectedQuestionId = event.target.value;

            if (formId && formName && selectedQuestionId) {
                renderAnswerDistributionChart(formId, formName, selectedQuestionId);
                 // Resize the chart after updating data
                 // Add a slight delay to ensure the DOM has updated before resizing
                 setTimeout(() => {
                    if (answerDistributionChart) answerDistributionChart.resize();
                    console.log("dashboard.js: Resized answer distribution chart after question select change.");
                 }, 50); // Adjust delay if needed
            } else {
                 console.warn("dashboard.js: Could not get form info or selected question ID for distribution chart.");
                 if(answerDistributionChart) answerDistributionChart.destroy();
                 answerDistributionMessageEl.textContent = "Select a question to see distribution.";
            }
        });
    }


    // --- Auth State Change Handler ---
    auth.onAuthStateChanged(user => {
        console.log("dashboard.js: Auth state changed. User:", user ? user.email : 'null');
        if (user) {
            currentUser = user;
            fetchUserFormsAndInitDashboard(); // Fetch forms and set up listener
             // Update user email display in header
             const userEmailDisplayEl = document.getElementById('userEmailDisplay');
             if (userEmailDisplayEl) {
                 userEmailDisplayEl.textContent = user.email || 'User';
                 userEmailDisplayEl.style.display = 'inline-block';
             }
             // Show logout button
             const logoutButton = document.getElementById('logoutButton');
             if (logoutButton) logoutButton.style.display = 'inline-flex';

        } else {
            // User is signed out
            currentUser = null;
            allUserForms = [];

            // Detach the user forms listener
            if (userFormsListener) {
                // Need a way to get the ref, or re-get it using a placeholder UID if listener is still active
                // A cleaner way is for auth.js to trigger a cleanup function in dashboard.js on sign out.
                // For now, we'll just nullify the variable.
                // db.ref(`users/${PREVIOUS_USER_ID_IF_AVAILABLE}/forms`).off('value', userFormsListener);
                userFormsListener = null;
                console.log("dashboard.js: User signed out, userFormsListener detached (variable nullified).");
            }
             // Detach specific form stats listener if active
            detachCurrentFormStatsListener();


            updateHomeStats([]); // Clear home stats
            if (userFormsListEl) userFormsListEl.innerHTML = '<p class="status-message info"><i class="fas fa-info-circle mr-2"></i> Please log in to see your forms.</p>';

            // Destroy all charts
            if (responsesChart) { responsesChart.destroy(); responsesChart = null; }
            if (responsesOverTimeChart) { responsesOverTimeChart.destroy(); responsesOverTimeChart = null; }
            if (answerDistributionChart) { answerDistributionChart.destroy(); answerDistributionChart = null; }

             // Hide user info and logout button in header
             const userEmailDisplayEl = document.getElementById('userEmailDisplay');
             if (userEmailDisplayEl) userEmailDisplayEl.style.display = 'none';
             const logoutButton = document.getElementById('logoutButton');
             if (logoutButton) logoutButton.style.display = 'none';


            // auth.js handles redirection to login.html
            // showLoadingOverlay(); // Re-show overlay as user is being logged out/redirected
        }
    });
    console.log("dashboard.js: Script loaded. Waiting for auth state.");
});
