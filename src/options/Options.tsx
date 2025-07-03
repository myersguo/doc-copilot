import React, { useState, useEffect } from 'react';
import { ExtensionConfig } from '../types';
import './index.css';

const defaultConfig: ExtensionConfig = {
    urls: [
      'https://bytedance.sg.larkoffice.com/docx/*',
      'https://bytedance.larkoffice.com/docx/*',
    ],
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    waitTime: 2,
    prompt: `You are an intelligent text completion assistant. Complete the text naturally at the cursor position based on the given context.
Instructions:

Return only the completion text - do not repeat existing content
Ensure completions flow naturally and match the context
Maintain the same language style and formatting as the original text
For lists or structured content, continue the established format
Keep completions concise, typically 1-2 sentences
Provide no additional explanations or commentary

Input Format:
[Text before cursor]<CURSOR>[Text after cursor]
Output: Return only the text that should be inserted at the <CURSOR> position.

Key improvements made:

Clearer structure with bold headings for better readability
More concise and direct language
Emphasized the core instruction (return only completion text) upfront
Streamlined rules for easier parsing
Added explicit output instruction at the end
Maintained all original functionality while improving clarity`,
    imagePrompt: 'Create a clean, modern, minimal infographic or visual card that visually expresses the following idea: [TextOfParagraph]\n\nStyle: flat design, simple icons, bold typography, clear structure, suitable for quick sharing on social media or presentations.',
};


const Options: React.FC = () => {
    const [config, setConfig] = useState<ExtensionConfig>(defaultConfig);
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        chrome.storage.sync.get(defaultConfig, (data) => {
            setConfig(data as ExtensionConfig);
        });
    }, []);

    const handleSave = () => {
        if (!config.apiKey.trim()) {
            setStatus({ message: 'API Key is required.', type: 'error' });
            return;
        }
        if (config.urls.length === 0 || config.urls.every(u => !u.trim())) {
            setStatus({ message: 'At least one URL pattern is required.', type: 'error' });
            return;
        }

        const cleanedConfig = {
            ...config,
            urls: config.urls.map(u => u.trim()).filter(Boolean),
        };

        chrome.storage.sync.set(cleanedConfig, () => {
            if (chrome.runtime.lastError) {
                setStatus({ message: `Save failed: ${chrome.runtime.lastError.message}`, type: 'error' });
            } else {
                setStatus({ message: 'Configuration saved successfully!', type: 'success' });
                // Notify content scripts
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                           chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED', config: cleanedConfig })
                             .catch(() => { /* Ignore errors for tabs that can't be reached */ });
                        }
                    });
                });
                setTimeout(() => setStatus(null), 3000);
            }
        });
    };
    
    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset to default settings?')) {
            setConfig(defaultConfig);
            setStatus({ message: 'Settings have been reset to default.', type: 'success'});
        }
    }

    const handleUrlChange = (index: number, value: string) => {
        const newUrls = [...config.urls];
        newUrls[index] = value;
        setConfig({ ...config, urls: newUrls });
    };

    const addUrl = () => {
        setConfig({ ...config, urls: [...config.urls, ''] });
    };

    const removeUrl = (index: number) => {
        const newUrls = config.urls.filter((_, i) => i !== index);
        setConfig({ ...config, urls: newUrls });
    };

    return (
        <div className="container">
            <h1>AI Auto-Completion Settings</h1>

            <div className="section-title">
                Basic Configuration
                <button type="button" className="reset-btn" onClick={handleReset}>Reset to Default</button>
            </div>
            <div className="config-group">
                <label>Matching URL Patterns:</label>
                <p className="help-text">The extension will activate on these URLs. Use * as a wildcard.</p>
                <div className="url-list">
                    {config.urls.map((url, index) => (
                        <div key={index} className="url-item">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => handleUrlChange(index, e.target.value)}
                                placeholder="https://example.com/docs/*"
                            />
                            <button type="button" className="remove-btn" onClick={() => removeUrl(index)}>Remove</button>
                        </div>
                    ))}
                </div>
                <button type="button" className="add-btn" onClick={addUrl}>Add URL Pattern</button>
            </div>

            <div className="section-title">API Configuration</div>
             {/* API URL, Key, Model Inputs... */}
             <div className="config-group">
                <label htmlFor="apiUrl">OpenAI Compatible API URL:</label>
                <input id="apiUrl" type="text" value={config.apiUrl} onChange={e => setConfig({...config, apiUrl: e.target.value})} />
            </div>
            <div className="config-group">
                <label htmlFor="apiKey">API Key:</label>
                <input id="apiKey" type="password" value={config.apiKey} onChange={e => setConfig({...config, apiKey: e.target.value})} placeholder="sk-..." />
            </div>
             <div className="config-group">
                <label htmlFor="model">Model Name:</label>
                <input id="model" type="text" value={config.model} onChange={e => setConfig({...config, model: e.target.value})} />
            </div>

            <div className="section-title">Behavior Configuration</div>
            <div className="config-group">
                <label htmlFor="waitTime">Wait Time (seconds):</label>
                <input id="waitTime" type="number" min="1" max="10" value={config.waitTime} onChange={e => setConfig({...config, waitTime: parseInt(e.target.value, 10)})} />
                 <p className="help-text">Time to wait after user stops typing to trigger completion (1-10s).</p>
            </div>
            <div className="config-group">
                <label htmlFor="prompt">System Prompt:</label>
                <textarea id="prompt" value={config.prompt} onChange={e => setConfig({...config, prompt: e.target.value})} />
            </div>
            <div className="config-group">
                <label htmlFor="imagePrompt">Image Generation Prompt:</label>
                <textarea id="imagePrompt" value={config.imagePrompt} onChange={e => setConfig({...config, imagePrompt: e.target.value})} />
                <p className="help-text">Prompt for generating image descriptions. Use [TextOfParagraph] as placeholder for the paragraph text.</p>
            </div>

            <button onClick={handleSave} className="save-btn">Save Settings</button>
            {status && <div className={`status ${status.type}`}>{status.message}</div>}
        </div>
    );
};

export default Options;
