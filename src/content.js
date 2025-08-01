// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getComposeContext') {
        // Get context from the compose area
        const context = getComposeContext();
        sendResponse({ success: true, context: context });
        return true;
    } else if (request.action === 'insertText') {
        // Insert text into the compose area
        const success = insertTextIntoCompose(request.text);
        sendResponse({ success: success });
        return true;
    }
});

function getComposeContext() {
    // Find the compose area
    const composeArea = document.querySelector(".Am.Al.editable") || 
                       document.querySelector("[role='textbox']") ||
                       document.querySelector("[contenteditable='true']");
    
    if (!composeArea) {
        return { error: 'No compose area found' };
    }

    // Get the current text content (but don't show it in popup)
    const currentText = composeArea.innerText || composeArea.textContent || '';
    
    // Get subject line if available
    const subjectField = document.querySelector('input[name="subjectbox"]') || 
                        document.querySelector('[placeholder*="Subject"]') ||
                        document.querySelector('[aria-label*="Subject"]');
    const subject = subjectField ? subjectField.value : '';

    // Get recipient info if available
    const toField = document.querySelector('input[name="to"]') || 
                   document.querySelector('[placeholder*="Recipients"]') ||
                   document.querySelector('[aria-label*="To"]');
    const recipients = toField ? toField.value : '';

    // Get the email being replied to (if this is a reply)
    const replyToEmail = getReplyToEmailContext();

    return {
        currentText: currentText,
        subject: subject,
        recipients: recipients,
        replyToEmail: replyToEmail,
        hasContent: currentText.length > 0
    };
}

function getReplyToEmailContext() {
    // Look for the original email content in the reply view
    // Gmail typically shows the original email in a quoted/indented area
    
    // Try multiple selectors for the original email content
    const originalEmailSelectors = [
        // Gmail's quoted reply content
        '.gmail_quote',
        '.gmail_default',
        '[data-legacy-message-id]',
        // Original email content in reply view
        '.adn',
        '.a3s',
        '.msg',
        // Quoted text areas
        'blockquote',
        '.quote',
        // Gmail's specific reply content areas
        '[role="main"] .adn',
        '[role="main"] .a3s',
        // Look for content that's indented or quoted
        'div[style*="margin-left"]',
        'div[style*="padding-left"]',
        // Gmail's message body in reply view
        '.h7',
        '.hP'
    ];

    for (const selector of originalEmailSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            // Skip if this is the compose area itself
            if (element.closest('.gU.UP') || element.closest('[role="dialog"]')) {
                continue;
            }
            
            const text = element.innerText || element.textContent || '';
            if (text.length > 50 && text.length < 5000) { // Reasonable length for an email
                // Clean up the text (remove extra whitespace, etc.)
                return text.replace(/\s+/g, ' ').trim();
            }
        }
    }

    // If no specific reply content found, try to get the last email in the thread
    const emailThread = document.querySelector('.adn, .a3s, .msg');
    if (emailThread) {
        const text = emailThread.innerText || emailThread.textContent || '';
        if (text.length > 50) {
            return text.replace(/\s+/g, ' ').trim();
        }
    }

    return null;
}

function insertTextIntoCompose(text) {
    // Find the compose area
    const composeArea = document.querySelector(".Am.Al.editable") || 
                       document.querySelector("[role='textbox']") ||
                       document.querySelector("[contenteditable='true']");
    
    if (!composeArea) {
        return false;
    }

    // Clear existing content and insert new text
    composeArea.innerText = text;
    
    // Trigger input event to ensure Gmail recognizes the change
    const inputEvent = new Event('input', { bubbles: true });
    composeArea.dispatchEvent(inputEvent);
    
    return true;
}

