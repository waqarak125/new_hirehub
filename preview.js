// This script should be linked in preview.html using <script src="preview.js" defer></script>

// firebaseConfig is expected to be globally defined in preview.html <head>

// Declare databaseURL and storageBucket variables globally in this script's scope
let databaseURL = firebaseConfig.databaseURL;
let storageBucket = firebaseConfig.storageBucket;
let storage; // Will be initialized after Firebase app

// Global variables to store form details fetched from DB
let currentFormId = null;
let currentFormOwnerId = null; // Store the UID of the form owner

// Initialize Firebase App
if (!firebase.apps.length) {
    try {
         firebase.initializeApp(firebaseConfig);
         console.log("Firebase App initialized successfully from preview.js.");
         storage = firebase.storage(); // Initialize storage after app initialization
    } catch (error) {
         console.error("Error initializing Firebase App from preview.js:", error);
         const formContentDiv = document.getElementById("formContent");
         if (formContentDiv) {
            formContentDiv.innerHTML = `<p class="error-message">Error initializing Firebase App: ${error.message}. Please check your firebaseConfig and the browser console for details.</p>`;
         }
         const formHeader = document.getElementById("formHeader");
         if (formHeader) {
            formHeader.innerText = "Error Loading Form";
         }
    }
} else {
    firebase.app(); // if already initialized, use that app
    console.log("Firebase App already initialized (checked from preview.js).");
    storage = firebase.storage(); // Initialize storage if app was already initialized
}


// --- Run Code After DOM is Loaded ---
document.addEventListener('DOMContentLoaded', async () => {
    const formContentDiv = document.getElementById("formContent");
    const formHeader = document.getElementById("formHeader");

    // Get the formId from the URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('formId');
    currentFormId = formId; // Store the formId globally

    if (!currentFormId) {
        formContentDiv.innerHTML = "<p class='error-message'>Error: No form ID provided in the URL.</p>";
        formHeader.innerText = "Error Loading Form";
        return;
    }

    // Check if databaseURL is configured
    if (!databaseURL || databaseURL.includes("YOUR_DATABASE_URL")) {
        console.error("Firebase Realtime Database URL is not configured. Cannot load form.");
        formContentDiv.innerHTML = "<p class='error-message'>Error: Firebase Realtime Database URL is not configured.</p>";
        formHeader.innerText = "Error Loading Form";
        return;
    }
    // Check if storageBucket is configured for file uploads
    if (!storageBucket || storageBucket.includes("YOUR_STORAGE_BUCKET")) {
        console.warn("Firebase Storage Bucket is not configured. File uploads will not work.");
        const storageWarning = document.createElement('p');
        storageWarning.className = 'error-message';
        storageWarning.innerText = 'Warning: Firebase Storage is not configured. File upload questions will not function correctly.';
        if (formContentDiv.firstChild) {
            formContentDiv.insertBefore(storageWarning, formContentDiv.firstChild);
        } else {
            formContentDiv.appendChild(storageWarning);
        }
    }

    // --- Fetch form data from Realtime Database using REST API ---
    // Fetch the full form data, including the owner UID
    try {
        const response = await fetch(`${databaseURL}/forms/${currentFormId}.json`);

        if (!response.ok) {
             const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const formData = await response.json();
        console.log("Fetched form data:", formData);

        if (formData && formData.questions && Array.isArray(formData.questions)) {
            formHeader.innerText = formData.name || "Untitled Form";
            currentFormOwnerId = formData.owner; // Store the owner UID

            if (!currentFormOwnerId) {
                 console.warn(`Form ${currentFormId} does not have an owner UID. Submission count will not update on dashboard.`);
                 const ownerWarning = document.createElement('p');
                 ownerWarning.className = 'error-message';
                 ownerWarning.innerText = 'Warning: Form owner information is missing. Submission count may not update on the dashboard.';
                 if (formContentDiv.firstChild) {
                     formContentDiv.insertBefore(ownerWarning, formContentDiv.firstChild);
                 } else {
                     formContentDiv.appendChild(ownerWarning);
                 }
            }

            renderForm(formData);
        } else {
            formContentDiv.innerHTML = "<p class='error-message'>Error: Form data not found or invalid structure.</p>";
            formHeader.innerText = "Error Loading Form";
        }

    } catch (error) {
        console.error("Error fetching form from Realtime Database:", error);
        formContentDiv.innerHTML = `<p class='error-message'>Error loading form: ${error.message}</p>`;
        formHeader.innerText = "Error Loading Form";
    }
});

/**
 * Renders the form dynamically based on the fetched form data.
 * @param {object} formData - The form data object containing questions and potentially owner.
 */
function renderForm(formData) {
    const formContentDiv = document.getElementById("formContent");
    // Clear loading message and any previous warnings
    const loadingMessage = formContentDiv.querySelector('.loading-message');
    if (loadingMessage) loadingMessage.remove();
    // Keep storage warning if it exists, or clear everything else
    const storageWarning = formContentDiv.querySelector('.error-message[innerText*="Firebase Storage"]');
    const ownerWarning = formContentDiv.querySelector('.error-message[innerText*="Form owner information is missing"]');

    formContentDiv.innerHTML = ""; // Clear other content
    if (storageWarning) formContentDiv.appendChild(storageWarning); // Re-add storage warning if it was there
    if (ownerWarning) formContentDiv.appendChild(ownerWarning); // Re-add owner warning if it was there


    const formElement = document.createElement("form");
    formElement.id = "dynamicForm";

    formData.questions.forEach((question, index) => {
        const questionBlock = document.createElement("div");
        questionBlock.className = "form-question";

        const questionLabel = document.createElement("label");
        questionLabel.innerText = `${index + 1}. ${question.text}`;
        const inputId = `q_${question.id || index}`;

        questionBlock.appendChild(questionLabel);

        let inputElement;
        switch (question.type) {
            case "text":
                inputElement = document.createElement("input");
                inputElement.type = "text";
                inputElement.placeholder = "Your answer";
                questionLabel.setAttribute('for', inputId);
                inputElement.id = inputId;
                questionBlock.appendChild(inputElement);
                break;
            case "number":
                inputElement = document.createElement("input");
                inputElement.type = "number";
                inputElement.placeholder = "Enter a number";
                questionLabel.setAttribute('for', inputId);
                inputElement.id = inputId;
                questionBlock.appendChild(inputElement);
                break;
            case "textarea":
                inputElement = document.createElement("textarea");
                inputElement.placeholder = "Your detailed answer";
                questionLabel.setAttribute('for', inputId);
                inputElement.id = inputId;
                questionBlock.appendChild(inputElement);
                break;
            case "dropdown":
                inputElement = document.createElement("select");
                questionLabel.setAttribute('for', inputId);
                inputElement.id = inputId;
                if (question.options && question.options.length > 0) {
                     const defaultOption = document.createElement("option");
                     defaultOption.value = "";
                     defaultOption.innerText = "-- Select an option --";
                     defaultOption.disabled = true;
                     defaultOption.selected = true;
                     inputElement.appendChild(defaultOption);

                    question.options.forEach(option => {
                        const optionElement = document.createElement("option");
                        optionElement.value = option;
                        optionElement.innerText = option;
                        inputElement.appendChild(optionElement);
                    });
                } else {
                    const noOptions = document.createElement("option");
                    noOptions.value = "";
                    noOptions.innerText = "No options available";
                    noOptions.disabled = true;
                    noOptions.selected = true;
                    inputElement.appendChild(noOptions);
                }
                questionBlock.appendChild(inputElement);
                break;
            case "multiple_choice":
            case "checkboxes":
                const optionsContainer = document.createElement("div");
                optionsContainer.className = "options-container";
                const inputType = question.type === "multiple_choice" ? "radio" : "checkbox";
                const nameAttribute = `q_${question.id || index}`;

                if (question.options && question.options.length > 0) {
                    question.options.forEach((option, optionIndex) => {
                        const optionLabel = document.createElement("label");
                        const optionInput = document.createElement("input");
                        optionInput.type = inputType;
                        optionInput.value = option;
                        optionInput.name = nameAttribute;
                        const optionId = `${inputId}_opt_${optionIndex}`;
                        optionInput.id = optionId;
                        optionLabel.setAttribute('for', optionId);
                        optionLabel.appendChild(optionInput);
                        optionLabel.appendChild(document.createTextNode(option));
                        optionsContainer.appendChild(optionLabel);
                    });
                } else {
                    optionsContainer.innerHTML = "<p style='font-size:0.9em; color:#888;'>No options defined.</p>";
                }
                questionBlock.appendChild(optionsContainer);
                break;
            case "yes_no":
                 const yesNoContainer = document.createElement("div");
                 yesNoContainer.className = "options-container yes-no-options";
                 const yesInput = document.createElement("input");
                 yesInput.type = "radio";
                 yesInput.name = `q_${question.id || index}`;
                 yesInput.value = "Yes";
                 yesInput.id = `${inputId}_yes`;
                 const yesLabel = document.createElement("label");
                 yesLabel.setAttribute('for', `${inputId}_yes`);
                 yesLabel.appendChild(yesInput);
                 yesLabel.appendChild(document.createTextNode("Yes"));

                 const noInput = document.createElement("input");
                 noInput.type = "radio";
                 noInput.name = `q_${question.id || index}`;
                 noInput.value = "No";
                 noInput.id = `${inputId}_no`;
                 const noLabel = document.createElement("label");
                 noLabel.setAttribute('for', `${inputId}_no`);
                 noLabel.appendChild(noInput);
                 noLabel.appendChild(document.createTextNode("No"));

                 yesNoContainer.appendChild(yesLabel);
                 yesNoContainer.appendChild(noLabel);
                 questionBlock.appendChild(yesNoContainer);
                 break;
            case "rating":
                const ratingContainer = document.createElement("div");
                ratingContainer.className = "options-container rating-options";
                const nameAttrRating = `q_${question.id || index}`;
                const ratingOptions = (question.options && question.options.length > 0 && question.options[0].toLowerCase().includes('scale'))
                    ? Array.from({ length: parseInt(question.options[0].split('-')[1] || 5) }, (_, i) => i + 1)
                    : [1, 2, 3, 4, 5];

                ratingOptions.forEach(value => {
                    const ratingLabel = document.createElement("label");
                    const ratingInput = document.createElement("input");
                    ratingInput.type = "radio";
                    ratingInput.name = nameAttrRating;
                    ratingInput.value = value;
                    ratingInput.id = `${inputId}_rating_${value}`;
                    ratingLabel.setAttribute('for', `${inputId}_rating_${value}`);
                    ratingLabel.appendChild(ratingInput);
                    ratingLabel.appendChild(document.createTextNode(value));
                    ratingContainer.appendChild(ratingLabel);
                });
                questionBlock.appendChild(ratingContainer);
                break;
             case "file":
                 inputElement = document.createElement("input");
                 inputElement.type = "file";
                 inputElement.id = inputId;
                 questionLabel.setAttribute('for', inputId);
                 if (question.options && question.options.length > 0) {
                     inputElement.accept = question.options.join(',');
                 }
                 const statusSpan = document.createElement("span");
                 statusSpan.className = "file-upload-status";
                 statusSpan.id = `status_${inputId}`;
                 questionBlock.appendChild(inputElement);
                 questionBlock.appendChild(statusSpan);
                 break;
            default:
                const unsupportedMessage = document.createElement("p");
                unsupportedMessage.innerText = `[Unsupported Answer Type: ${question.type}]`;
                unsupportedMessage.style.color = 'red';
                questionBlock.appendChild(unsupportedMessage);
                break;
        }
        formElement.appendChild(questionBlock);
    });

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.id = "submitFormButton";
    submitButton.innerText = "Submit Form";
    formElement.appendChild(submitButton);

    formElement.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentFormId) {
            console.error("Form ID is missing. Cannot submit.");
            displaySubmissionStatus('Error: Form ID is missing. Cannot submit.', 'error');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerText = "Submitting...";
        displaySubmissionStatus('Processing submission...', 'loading');

        const submissionData = {
            formId: currentFormId,
            submittedAt: new Date().toISOString(),
            responses: []
        };
        const uploadPromises = [];

        for (const [index, question] of formData.questions.entries()) {
            const questionId = question.id || index;
            const inputType = question.type;
            const inputElementId = `q_${questionId}`;
            const inputElement = formElement.querySelector(`#${inputElementId}`);
            const statusSpanId = `status_${inputElementId}`;
            const statusSpan = formElement.querySelector(`#${statusSpanId}`);
            let answer = null;
            const nameAttribute = `q_${questionId}`;

            if (inputType !== 'file') {
                 switch (inputType) {
                        case "text":
                        case "number":
                        case "textarea":
                        case "dropdown":
                             if (inputElement) answer = inputElement.value;
                             break;
                        case "multiple_choice":
                        case "yes_no":
                        case "rating":
                             const selectedRadio = formElement.querySelector(`input[name="${nameAttribute}"]:checked`);
                             if (selectedRadio) answer = selectedRadio.value;
                             break;
                        case "checkboxes":
                             answer = [];
                             const checkedCheckboxes = formElement.querySelectorAll(`input[name="${nameAttribute}"]:checked`);
                             checkedCheckboxes.forEach(checkbox => answer.push(checkbox.value));
                             break;
                        default:
                             answer = `[Unsupported Type: ${inputType}]`;
                             break;
                  }
                 submissionData.responses.push({
                     questionId: question.id || `q_idx_${index}`,
                     questionText: question.text,
                     answer: answer
                 });
            } else {
                 if (inputElement && inputElement.files && inputElement.files.length > 0) {
                     const file = inputElement.files[0];
                     if (statusSpan) {
                         statusSpan.className = "file-upload-status uploading";
                         statusSpan.innerText = `Uploading ${file.name}...`;
                     }
                     uploadPromises.push(uploadFile(currentFormId, question.id || `q_idx_${index}`, file, statusSpan));
                 } else {
                     submissionData.responses.push({
                         questionId: question.id || `q_idx_${index}`,
                         questionText: question.text,
                         answer: null
                     });
                 }
            }
        }

        const fileUploadResults = await Promise.all(uploadPromises);
        fileUploadResults.forEach(result => {
             if (result) {
                  // Find the original question to get its text for the submission response
                  const originalQuestion = formData.questions.find(q => (q.id || `q_idx_${formData.questions.indexOf(q)}`) === result.questionId);
                  submissionData.responses.push({
                       questionId: result.questionId,
                       questionText: originalQuestion ? originalQuestion.text : "Unknown File Question",
                       answer: result.answer // This will be the download URL or an error message
                  });
             }
        });

        console.log("Final Submission Data:", submissionData);

        if (!databaseURL || databaseURL.includes("YOUR_DATABASE_URL")) {
            console.error("Firebase Realtime Database URL is not configured. Cannot submit form.");
            displaySubmissionStatus('Error: Firebase Realtime Database URL is not configured.', 'error');
            submitButton.disabled = false;
            submitButton.innerText = "Submit Form";
            return;
        }

        // --- Save submission data ---
        fetch(`${databaseURL}/formSubmissions/${currentFormId}.json`, { // Save submissions under /formSubmissions/{formId}
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        })
        .then(response => {
            if (!response.ok) {
                 return response.text().then(text => {
                     console.error(`Submission HTTP error! Status: ${response.status}, Body: ${text}`);
                     throw new Error(`Submission failed with status ${response.status}.`);
                 });
            }
            return response.json();
        })
        .then(responseData => {
            console.log('Submission saved:', responseData);

            // --- Increment submission count for the form owner ---
            if (currentFormOwnerId && currentFormId) {
                 const submissionCountRef = firebase.database().ref(`users/${currentFormOwnerId}/forms/${currentFormId}/submissionCount`);
                 submissionCountRef.transaction((currentCount) => {
                     // If currentCount is null or undefined, start at 0 before incrementing
                     return (currentCount || 0) + 1;
                 }, (error, committed, snapshot) => {
                     if (error) {
                         console.error("Transaction failed: Could not increment submission count", error);
                         // Optionally display a warning to the user
                     } else if (!committed) {
                         console.log("Transaction aborted: Submission count was updated concurrently.");
                     } else {
                         console.log("Submission count incremented successfully to", snapshot.val());
                     }
                 });
            } else {
                 console.warn("Cannot increment submission count: Form owner ID or Form ID is missing.");
            }
            // --- End Increment submission count ---


            displaySubmissionStatus('Form submitted successfully!', 'success');
            formElement.reset();
            formElement.querySelectorAll('.file-upload-status').forEach(span => span.innerText = '');
            submitButton.disabled = true;
            submitButton.innerText = "Submitted";
        })
        .catch(error => {
            console.error('Error submitting form:', error);
            displaySubmissionStatus(`Error submitting form: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.innerText = "Submit Form";
        });
    });

    formContentDiv.appendChild(formElement);
}

/**
 * Uploads a file to Firebase Storage.
 * @param {string} formId - The ID of the form.
 * @param {string} questionId - The ID of the question.
 * @param {File} file - The file to upload.
 * @param {HTMLElement} statusElement - The element to update with upload status.
 * @returns {Promise<object | null>} Resolves with { questionId, answer: downloadURL/error_message }.
 */
async function uploadFile(formId, questionId, file, statusElement) {
     if (!file) return null;
     if (!storage) { // Check if storage was initialized
        const errorMessage = "Firebase Storage is not initialized.";
        console.error(errorMessage);
        if (statusElement) {
            statusElement.className = "file-upload-status error";
            statusElement.innerText = errorMessage;
        }
        return { questionId: questionId, answer: errorMessage };
     }

     if (!storageBucket || storageBucket.includes("YOUR_STORAGE_BUCKET")) {
         const errorMessage = "Firebase Storage is not configured.";
         console.error(errorMessage);
         if (statusElement) {
             statusElement.className = "file-upload-status error";
             statusElement.innerText = errorMessage;
         }
         return { questionId: questionId, answer: errorMessage };
     }

    const storageRef = storage.ref();
    // Sanitize questionId and use a timestamp to ensure unique file paths
    const sanitizedQuestionId = questionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const fileName = `${formId}/${sanitizedQuestionId}/${timestamp}_${file.name}`;
    const fileRef = storageRef.child(fileName);

    try {
        const uploadTask = fileRef.put(file);
        return new Promise((resolve, reject) => { // Wrap in a new Promise for on.state_changed
            uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED,
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                    if (statusElement) {
                        statusElement.className = "file-upload-status uploading";
                        statusElement.innerText = `Uploading ${file.name}: ${progress.toFixed(0)}%`;
                    }
                },
                (error) => { // Handle unsuccessful uploads from the listener
                    console.error("File upload failed (listener):", error);
                    const errorMessage = `Upload failed: ${error.code || error.message}`;
                     if (statusElement) {
                         statusElement.className = "file-upload-status error";
                         statusElement.innerText = errorMessage;
                     }
                     resolve({ questionId: questionId, answer: errorMessage }); // Resolve with error for Promise.all
                },
                async () => { // Handle successful uploads on complete
                    try {
                        const downloadURL = await fileRef.getDownloadURL();
                        console.log('File available at', downloadURL);
                         if (statusElement) {
                             statusElement.className = "file-upload-status uploaded";
                             statusElement.innerText = `Uploaded: ${file.name}`;
                         }
                         resolve({ questionId: questionId, answer: downloadURL });
                    } catch (getUrlError) {
                        console.error("Error getting download URL:", getUrlError);
                        const errorMessage = `Error getting URL: ${getUrlError.code || getUrlError.message}`;
                        if (statusElement) {
                            statusElement.className = "file-upload-status error";
                            statusElement.innerText = errorMessage;
                        }
                        resolve({ questionId: questionId, answer: errorMessage });
                    }
                }
            );
        });
    } catch (error) { // Catches errors from the initial fileRef.put() call if it fails synchronously
        console.error("Error starting file upload process:", error);
        const errorMessage = `Upload process error: ${error.code || error.message}`;
         if (statusElement) {
             statusElement.className = "file-upload-status error";
             statusElement.innerText = errorMessage;
         }
         return { questionId: questionId, answer: errorMessage }; // Resolve with error for Promise.all
    }
}

/**
  * Displays a status message (success, error, or loading) to the user.
  * @param {string} message - The message to display.
  * @param {'success' | 'error' | 'loading'} type - The type of message.
  */
 function displaySubmissionStatus(message, type) {
     const formContentDiv = document.getElementById("formContent");
     const existingStatus = formContentDiv.querySelector('.success-message, .error-message, .loading-message');
     if (existingStatus) {
         existingStatus.remove();
     }

     const statusElement = document.createElement("p");
     statusElement.className = type === 'success' ? 'success-message' : (type === 'loading' ? 'loading-message' : 'error-message');
     statusElement.innerText = message;

      // Add icons based on type
     if (type === 'loading') {
         statusElement.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${message}`;
     } else if (type === 'error') {
         statusElement.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i> ${message}`;
     } else if (type === 'success') {
          statusElement.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${message}`;
     }


     const dynamicForm = document.getElementById('dynamicForm');
     if (dynamicForm) {
         formContentDiv.insertBefore(statusElement, dynamicForm);
     } else {
         // If dynamicForm isn't there yet, try to insert before the first child, or append if empty
         if (formContentDiv.firstChild) {
            formContentDiv.insertBefore(statusElement, formContentDiv.firstChild);
         } else {
            formContentDiv.appendChild(statusElement);
         }
     }

     // Optional: Automatically hide success/error messages after a few seconds
     if (type === 'success' || type === 'error') {
         setTimeout(() => {
             statusElement.remove();
         }, 5000); // Remove after 5 seconds
     }
 }
