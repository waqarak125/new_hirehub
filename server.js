// server.js

const fetch = require('node-fetch');
if (typeof global.fetch !== 'function') {
    global.fetch = fetch;
    global.Headers = fetch.Headers;
    global.Request = fetch.Request;
    global.Response = fetch.Response;
}

require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// --- Gemini API Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not set.");
    console.error("Please set the GEMINI_API_KEY environment variable.");
    // In a production environment, you might want to handle this more gracefully than exiting
    // For example, disable the AI analysis endpoint or return an error response.
    // For this example, we'll exit as it's a critical dependency for the AI feature.
    process.exit(1);
}

let genAI;
let model;

try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Use a model suitable for structured output
    model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest", // Or "gemini-1.0-pro" for potentially better results at higher cost/latency
        generationConfig: {
            temperature: 0.7, // Controls randomness. Lower values are more deterministic.
            topK: 1,
            topP: 1,
            maxOutputTokens: 4096, // Increased token limit for potentially larger analysis
            responseMimeType: "application/json", // Request JSON output
        },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
    });
    console.log("Google Generative AI model initialized successfully.");
} catch (error) {
    console.error("FATAL ERROR: Failed to initialize Google Generative AI model.", error);
    console.error("Please check your GEMINI_API_KEY and ensure the model name is correct and available.");
     genAI = null; // Ensure genAI is null if initialization fails
     model = null; // Ensure model is null if initialization fails
    // Decide how to handle this failure - either disable the endpoint or exit.
    // For now, the endpoint will check if `model` is available.
}


// --- API Endpoint for Candidate Analysis ---
app.post('/analyze-candidates', async (req, res) => {
    console.log("Received request for /analyze-candidates");
    const { formId, formStructure, submissionsArray, customInstructions } = req.body;

    if (!formId || !formStructure || !submissionsArray || !Array.isArray(submissionsArray) || submissionsArray.length === 0) {
        console.warn("Invalid request body:", req.body);
        return res.status(400).json({ error: "Missing or invalid data.", details: "Required: formId, formStructure, submissionsArray (non-empty array)." });
    }

     if (!model) {
         console.error("AI model is not initialized. Cannot perform analysis.");
         return res.status(500).json({ error: "AI service is not available.", details: "Model initialization failed on the server." });
     }


    // --- Construct the prompt for Gemini ---
    let prompt = `You are an AI assistant designed to analyze candidate submissions for a job application form.
Evaluate each candidate's responses based on the provided form questions and the specific instructions.
Provide a structured analysis for each candidate in the specified JSON format.

Form Questions:
`;
    formStructure.questions.forEach((q, index) => {
        prompt += `${index + 1}. Type: ${q.type}, Text: "${q.text}"\n`;
        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
            prompt += `   Options: ${q.options.join(', ')}\n`;
        }
    });

    prompt += `\nCustom Instructions for Analysis:\n`;
    prompt += customInstructions && customInstructions.trim() !== "" ? customInstructions.trim() : "None provided. Analyze based on general hiring best practices and relevance to typical job requirements.";

    prompt += `\n\nCandidate Submissions (Analyze each separately):\n`;
    submissionsArray.forEach((sub, subIndex) => {
        prompt += `\n--- Candidate ${subIndex + 1} ---\n`;
        prompt += `Submission ID: ${sub.submissionId}\n`;
        prompt += `Submitted At: ${sub.submittedAt}\n`;
        prompt += `Responses:\n`;
        if (sub.responses && Array.isArray(sub.responses)) {
            sub.responses.forEach(res => {
                let answerContent = res.answer;
                 if (Array.isArray(answerContent)) {
                     answerContent = answerContent.join(', '); // Join array answers for prompt
                 } else if (answerContent === null || answerContent === undefined) {
                     answerContent = "[No Answer]";
                 } else if (typeof answerContent === 'string' && (answerContent.startsWith('http://') || answerContent.startsWith('https://'))) {
                     answerContent = `[File Upload] ${answerContent}`; // Indicate it's a file link
                 } else {
                      answerContent = String(answerContent); // Ensure string
                 }
                prompt += `  - ${res.questionText}: "${answerContent}"\n`;
            });
        } else {
            prompt += "  [No responses recorded]\n";
        }
    });

    prompt += `\n\nProvide the analysis for all candidates as a single JSON array.
The JSON structure should be an array of objects, where each object represents a candidate analysis and MUST include:
{
  "submissionId": "...", // The exact submissionId from the input
  "candidateAlias": "Candidate X", // A simple alias like "Candidate 1", "Candidate 2", etc. corresponding to the order in the input
  "submittedAt": "...", // The submittedAt timestamp from the input
  "summary": "...", // A brief overall summary
  "strengths": ["...", "..."], // Key strengths as an array of strings
  "weaknesses": ["...", "..."], // Key weaknesses or areas for concern as an array of strings
  "categoryScores": { "Category Name": Score }, // Optional: Scores for relevant categories (e.g., "Communication": 8, "Experience": 9), object where scores are out of 10. Include only relevant categories. Can be empty {}.
  "overallFitScore": ..., // An overall score out of 10 (number, e.g., 7.5) based on questions and instructions
  "fitReasoning": "...", // Explanation for the overall fit score
  "isFlagged": false, // Boolean: true if the candidate has significant red flags
  "flagReason": "..." // String: Reason for flagging, if isFlagged is true
}

Ensure the response is ONLY the JSON array, enclosed in a single code block, and is valid JSON. Do not include any introductory or concluding text outside the JSON.
`;

    console.log("Sending prompt to Gemini API...");
    // console.log("Prompt:", prompt); // Log prompt for debugging if needed (can be large)

    try {
        // Call the Gemini API
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
             // generationConfig and safetySettings are now part of model initialization
        });

        // Extract text output from the response
        const geminiResponse = result.response;
        if (!geminiResponse || !geminiResponse.candidates || geminiResponse.candidates.length === 0) {
            console.error("Gemini API returned no candidates:", geminiResponse);
            return res.status(500).json({ error: "AI analysis failed: No response from AI model.", details: "Gemini returned an empty response." });
        }

        const geminiOutputText = geminiResponse.candidates[0].content.parts.map(part => part.text).join('');
        console.log("Raw Gemini Output:", geminiOutputText);

        // Clean the output to extract the JSON string
        // This regex looks for a JSON code block (```json ... ```) and captures its content
        const jsonMatch = geminiOutputText.match(/^```json\s*(.*?)\s*```$/s); // Use 's' flag for dotall

        let analysisJson;
        if (jsonMatch && jsonMatch[1]) {
            const jsonString = jsonMatch[1];
            try {
                 // Attempt to parse the extracted JSON string
                analysisJson = JSON.parse(jsonString);
                console.log("Parsed AI Analysis JSON from code block:", analysisJson);

                // Validate the structure (basic check)
                if (!Array.isArray(analysisJson) || analysisJson.some(item => !item.hasOwnProperty('submissionId'))) {
                     console.warn("AI output is JSON from code block but does not match the expected array structure with submissionId. Attempting to return anyway.");
                     // Attempt to return even if structure is slightly off, frontend might handle it
                     // Or you can throw an error here if strict structure is required
                     // throw new Error("AI output is in an unexpected JSON structure.");
                }

            } catch (parseError) {
                console.error("Failed to parse AI analysis JSON output from code block:", parseError);
                 console.error("Problematic JSON string:", jsonString);
                return res.status(500).json({ error: "AI analysis failed: Could not parse AI output.", details: `Parsing error: ${parseError.message}. Raw output started with: ${geminiOutputText.trim().substring(0, 200)}...` });
            }
        } else {
             console.warn("Gemini output did not contain a JSON code block. Attempting to parse raw output as JSON.");
              // If no JSON code block, try to parse the raw text as JSON
              try {
                   analysisJson = JSON.parse(geminiOutputText.trim());
                   console.log("Parsed raw AI Analysis JSON:", analysisJson);
                   // Validate the structure if parsing raw text
                   if (!Array.isArray(analysisJson) || analysisJson.some(item => !item.hasOwnProperty('submissionId'))) {
                       console.warn("Raw AI output parsed as JSON but does not match the expected array structure with submissionId. Attempting to return anyway.");
                        // throw new Error("Raw AI output is in an unexpected JSON structure.");
                   }
              } catch (rawParseError) {
                   console.error("Failed to parse raw AI analysis output as JSON:", rawParseError);
                    // If parsing raw text fails, return the raw text as an error detail
                   return res.status(500).json({ error: "AI analysis failed: AI output is not valid JSON or in an unexpected format.", details: `Raw output started with: ${geminiOutputText.trim().substring(0, 500)}...` }); // Return beginning of output
              }
        }


        // Ensure the response structure matches what compare.js expects
        // compare.js expects { candidateAnalyses: [...] }
        res.json({ candidateAnalyses: analysisJson });

    } catch (error) {
        console.error("Error during Gemini API call:", error);
        res.status(500).json({ error: "Error during AI analysis.", details: error.message });
    }
});


// --- Serve static files ---
// Default to editor page (index.html)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// HTML files
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html'))); // Editor
app.get('/editor.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html'))); // Alias for Editor
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html'))); // New Dashboard
app.get('/preview.html', (req, res) => res.sendFile(path.join(__dirname, 'preview.html')));
app.get('/result.html', (req, res) => res.sendFile(path.join(__dirname, 'result.html')));
app.get('/compare.html', (req, res) => res.sendFile(path.join(__dirname, 'compare.html')));

// CSS files
app.get('/editor.css', (req, res) => res.sendFile(path.join(__dirname, 'editor.css')));
app.get('/login.css', (req, res) => res.sendFile(path.join(__dirname, 'login.css')));
app.get('/dashboard.css', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.css'))); // New Dashboard CSS
app.get('/preview.css', (req, res) => res.sendFile(path.join(__dirname, 'preview.css')));
app.get('/result.css', (req, res) => res.sendFile(path.join(__dirname, 'result.css')));
app.get('/compare.css', (req, res) => res.sendFile(path.join(__dirname, 'compare.css')));


// JS files
app.get('/auth.js', (req, res) => res.sendFile(path.join(__dirname, 'auth.js')));
app.get('/editor.js', (req, res) => res.sendFile(path.join(__dirname, 'editor.js')));
// Add the route for dashboard.js
app.get('/dashboard.js', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.js')));
app.get('/preview.js', (req, res) => res.sendFile(path.join(__dirname, 'preview.js')));
app.get('/result.js', (req, res) => res.sendFile(path.join(__dirname, 'result.js')));
app.get('/compare.js', (req, res) => res.sendFile(path.join(__dirname, 'compare.js')));


app.listen(port, () => {
    console.log(`SmartForm server listening on port ${port}`);
    if (process.env.PROJECT_DOMAIN) {
        console.log(`Glitch live URL: https://${process.env.PROJECT_DOMAIN}.glitch.me`);
    }
});
