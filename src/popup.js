document.addEventListener('DOMContentLoaded', function() {
    
    const customPromptTextarea = document.getElementById('customPrompt');
    const generateBtn = document.getElementById('generateBtn');
    const statusDiv = document.getElementById('status');
    const contextInfo = document.getElementById('contextInfo');
    const contextDetails = document.getElementById('contextDetails');
    
    // Settings elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKey = document.getElementById('saveApiKey');
    const resetApiKey = document.getElementById('resetApiKey');

    // Get context when popup opens
    getComposeContext();
    
    // Load saved API key
    loadApiKey();

    // Focus on the textarea when popup opens
    customPromptTextarea.focus();

    generateBtn.addEventListener('click', async function() {
        const prompt = customPromptTextarea.value.trim();
        
        if (!prompt) {
            showStatus('Please enter a prompt', 'error');
            return;
        }

        // Get context and generate response
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'getComposeContext'
            }, async function(contextResponse) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: Make sure you are on Gmail', 'error');
                    return;
                }

                if (!contextResponse.success) {
                    showStatus('Could not get email context', 'error');
                    return;
                }

                // Generate AI response
                try {
                    const aiResponse = await generateAIResponse(prompt, contextResponse.context);
                    
                    // Insert the response into Gmail
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'insertText',
                        text: aiResponse
                    }, function(insertResponse) {
                        if (insertResponse && insertResponse.success) {
                            showStatus('Response inserted successfully!', 'success');
                            // Clear the textarea
                            customPromptTextarea.value = '';
                            // Close popup after a short delay
                            setTimeout(() => {
                                window.close();
                            }, 1500);
                        } else {
                            showStatus('Failed to insert response', 'error');
                        }
                    });
                } catch (error) {
                    showStatus(`Error: ${error.message}`, 'error');
                }
            });
        });
    });

    // Handle Enter key in textarea
    customPromptTextarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            generateBtn.click();
        }
    });

    // Settings functionality
    settingsBtn.addEventListener('click', function() {
        settingsModal.style.display = 'flex';
    });

    closeSettings.addEventListener('click', function() {
        settingsModal.style.display = 'none';
    });

    // Close modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    saveApiKey.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ 'geminiApiKey': apiKey }, function() {
                showStatus('API key saved successfully!', 'success');
                settingsModal.style.display = 'none';
            });
        } else {
            showStatus('Please enter a valid API key', 'error');
        }
    });

    resetApiKey.addEventListener('click', function() {
        chrome.storage.local.remove('geminiApiKey', function() {
            apiKeyInput.value = '';
            showStatus('API key reset successfully!', 'success');
            settingsModal.style.display = 'none'; // Close the modal
        });
    });

    function getComposeContext() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'getComposeContext'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: Make sure you are on Gmail', 'error');
                    return;
                }

                if (response && response.success && response.context) {
                    displayContext(response.context);
                }
            });
        });
    }

    function displayContext(context) {
        if (context.error) {
            return;
        }

        let contextHtml = '';
        
        if (context.recipients) {
            contextHtml += `<div class="context-detail"><strong>To:</strong> ${context.recipients}</div>`;
        }
        
        if (context.subject) {
            contextHtml += `<div class="context-detail"><strong>Subject:</strong> ${context.subject}</div>`;
        }
        
        if (context.replyToEmail) {
            const preview = context.replyToEmail.length > 150 
                ? context.replyToEmail.substring(0, 150) + '...' 
                : context.replyToEmail;
            contextHtml += `<div class="context-detail"><strong>Replying to:</strong> ${preview}</div>`;
        }

        contextDetails.innerHTML = contextHtml;
        contextInfo.style.display = 'block';
    }

    async function generateAIResponse(prompt, context) {
        // This is where you'd call your AI API
        // For now, we'll simulate a response
        const currentText = context.currentText || '';
        const subject = context.subject || '';
        const recipients = context.recipients || '';
        const replyToEmail = context.replyToEmail || '';
        
        // Build context for AI (you can modify this based on your AI API requirements)
        let aiContext = '';
        if (replyToEmail) {
            aiContext += `Original email: ${replyToEmail}\n\n`;
        }
        if (subject) {
            aiContext += `Subject: ${subject}\n`;
        }
        if (recipients) {
            aiContext += `To: ${recipients}\n`;
        }
        if (currentText) {
            aiContext += `Current draft: ${currentText}\n`;
        }

        const aiResponse = await callGemini(prompt, aiContext);

        return aiResponse;
    }

    function loadApiKey() {
        chrome.storage.local.get(['geminiApiKey'], function(result) {
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
            }
        });
    }

    async function callGemini(prompt, context){
        // Get API key from storage each time (more secure)
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['geminiApiKey'], resolve);
        });
        
        if (!result.geminiApiKey){
            throw new Error('Gemini API key is not set');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(result.geminiApiKey)}`;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: `Context: ${context}\n\nUser Request: ${prompt}\n\nPlease provide a helpful response based on the context and user request Please only give one response that would be helpful to the user. You are a helpful email assistant.`
                }]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok){
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content) {
            throw new Error('No response from Gemini API');
        }
        
        const text = candidate.content.parts?.[0]?.text || '';
        return text;        
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        // Hide status after 3 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
});
