import {
  AICompletionRequest,
  AICompletionResponse,
  AIImageRequest,
  AIImageResponse,
} from '../types';

// Listens for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AI_COMPLETION_REQUEST') {
    handleCompletionRequest(request, sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.type === 'AI_IMAGE_REQUEST') {
    handleImageRequest(request, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

/**
 * Handles the AI completion request from the content script.
 * @param message The request message.
 * @param sendResponse The function to call to send the response.
 */
async function handleCompletionRequest(
  message: AICompletionRequest,
  sendResponse: (response: AICompletionResponse) => void
): Promise<void> {
  const { requestId, config, context } = message;

  try {
    if (!config.apiKey) {
      throw new Error('API Key is not configured.');
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: config.prompt },
          { role: 'user', content: context },
        ],
        max_tokens: 150,
        temperature: 0.3,
        stop: ['\n\n', '<CURSOR>'],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      const completion = cleanCompletion(data.choices[0].message.content, context);
      console.log('AI Completion Success:', completion);
      sendResponse({
        success: true,
        requestId: requestId,
        completion: completion,
      });
    } else {
      throw new Error('API response format is invalid: Missing choices data.');
    }
  } catch (error) {
    console.error('AI Completion Request Failed:', error);
    sendResponse({
      success: false,
      requestId: requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Cleans the completion text to avoid repeating the user's context.
 * @param completion The raw text from the AI.
 * @param context The context sent to the AI.
 * @returns Cleaned completion text.
 */
function cleanCompletion(completion: string, context: string): string {
  if (!completion) return '';

  const beforeCursor = context.split('<CURSOR>')[0];
  let clean = completion.trim();
  
  // Remove potential quote wrapping
  clean = clean.replace(/^["']|["']$/g, '');

  // If completion starts with the context, remove it
  const beforeCursorTrimmed = beforeCursor.trim().toLowerCase();
  if (clean.toLowerCase().startsWith(beforeCursorTrimmed)) {
    clean = clean.substring(beforeCursorTrimmed.length).trimStart();
  }

  // Check and remove repeated last few words
  const words = beforeCursor.trim().split(/\s+/);
  for (let i = Math.min(words.length, 5); i > 0; i--) {
    const lastWords = words.slice(-i).join(' ');
    if (clean.toLowerCase().startsWith(lastWords.toLowerCase())) {
      clean = clean.substring(lastWords.length).trimStart();
      break;
    }
  }

  // Remove leading punctuation that might be redundant
  clean = clean.replace(/^[,，、。.]/, '');

  return clean;
}

async function handleImageRequest(
  message: AIImageRequest,
  sendResponse: (response: AIImageResponse) => void
): Promise<void> {
  const { requestId, config, paragraphText } = message;

  try {
    if (!config.apiKey) {
      throw new Error('API Key is not configured.');
    }

    const imagePrompt = config.imagePrompt.replace('[TextOfParagraph]', paragraphText);

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a creative assistant that generates concise, vivid descriptions for images based on text content.' },
          { role: 'user', content: imagePrompt },
        ],
        max_tokens: 100,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      const imageDescription = data.choices[0].message.content.trim();
      console.log('AI Image Generation Success:', imageDescription);
      sendResponse({
        success: true,
        requestId: requestId,
        imageDescription: imageDescription,
      });
    } else {
      throw new Error('API response format is invalid: Missing choices data.');
    }
  } catch (error) {
    console.error('AI Image Generation Request Failed:', error);
    sendResponse({
      success: false,
      requestId: requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('doc copilot has been installed.');
});
