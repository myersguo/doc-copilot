import React, { useState, useEffect } from 'react';
import { ExtensionConfig, AITalkTool } from '../types';
import './index.css';

const defaultAITalkTools: AITalkTool[] = [
  {
    id: 'explain',
    name: '解释',
    icon: '💡',
    enabled: true,
    prompt: `Please provide a detailed and easy-to-understand explanation of the following content. Assume the reader has no professional background. Please cover:

Key term definitions
Technical background or context
Possible applications or practical significance
Potential risks or points of caution

Content to explain:
[SELECTED_TEXT]`
  },
  {
    id: 'optimize',
    name: '优化',
    icon: '✨',
    enabled: true,
    prompt: `Please optimize the following content to make it clearer, more logically rigorous, and more concise. You may rewrite parts as needed, but please keep the original meaning. The optimization may include:

More concise and natural language
Improved structure and readability
Better technical accuracy
Stronger logic or persuasiveness

Content to optimize:
[SELECTED_TEXT]

Please provide the optimized version directly.`
  },
  {
    id: 'translate',
    name: '翻译',
    icon: '🚀',
    enabled: true,
    prompt: `Detect the input language:
- If it's Chinese, translate it into English.
- If it's not Chinese, translate it into Chinese.
Only return the translation. Do not include any notes, explanations, or extra output.
Text:
[SELECTED_TEXT]`,
  }
];

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
    aiTalkTools: defaultAITalkTools,
};

const Options: React.FC = () => {
    const [config, setConfig] = useState<ExtensionConfig>(defaultConfig);
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'ai-talk'>('general');
    const [aiTalkToolEnabled, setAiTalkToolEnabled] = useState<boolean>(true);

    useEffect(() => {
        chrome.storage.sync.get(defaultConfig, (data) => {
            setConfig(data as ExtensionConfig);
        });
    }, []);

    useEffect(() => {
        chrome.storage.sync.get(['aiTalkToolEnabled'], (data) => {
            if (typeof data.aiTalkToolEnabled === 'boolean') {
                setAiTalkToolEnabled(data.aiTalkToolEnabled);
            }
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

    // AI Talk 工具管理函数
    const handleToolChange = (index: number, field: keyof AITalkTool, value: string | boolean) => {
        const newTools = [...config.aiTalkTools];
        newTools[index] = { ...newTools[index], [field]: value };
        setConfig({ ...config, aiTalkTools: newTools });
    };

    const addTool = () => {
        const newTool: AITalkTool = {
            id: `tool_${Date.now()}`,
            name: '新工具',
            icon: '🔧',
            enabled: true,
            prompt: 'Please process the following content:\n\n[SELECTED_TEXT]'
        };
        setConfig({ ...config, aiTalkTools: [...config.aiTalkTools, newTool] });
    };

    const removeTool = (index: number) => {
        const newTools = config.aiTalkTools.filter((_, i) => i !== index);
        setConfig({ ...config, aiTalkTools: newTools });
    };

    const duplicateTool = (index: number) => {
        const toolToDuplicate = config.aiTalkTools[index];
        const newTool: AITalkTool = {
            ...toolToDuplicate,
            id: `tool_${Date.now()}`,
            name: `${toolToDuplicate.name} (Copy)`
        };
        setConfig({ ...config, aiTalkTools: [...config.aiTalkTools, newTool] });
    };

    return (
        <div className="container">
            <h1>AI Auto-Completion Settings</h1>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button 
                    className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    General Settings
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'ai-talk' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai-talk')}
                >
                    AI Talk Tools
                </button>
            </div>

            {/* General Settings Tab */}
            {activeTab === 'general' && (
                <>
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

                    <div className="section-title">Enable AI Talk Tools</div>
                    <div className="config-group ai-talk-switch-group">
                        <span className="ai-talk-switch-label">AI Talk 工具总开关：</span>
                        <input
                            id="aiTalkToolEnabled"
                            type="checkbox"
                            className="ai-talk-switch-checkbox"
                            checked={aiTalkToolEnabled}
                            onChange={e => {
                                setAiTalkToolEnabled(e.target.checked);
                                chrome.storage.sync.set({ aiTalkToolEnabled: e.target.checked }, () => {
                                    chrome.tabs.query({}, (tabs) => {
                                        tabs.forEach((tab) => {
                                            if (tab.id) {
                                                chrome.tabs.sendMessage(tab.id, { type: 'AITALKTOOL_SWITCH_UPDATED', enabled: e.target.checked })
                                                    .catch(() => { });
                                            }
                                        });
                                    });
                                });
                            }}
                        />
                    </div>
                </>
            )}

            {/* AI Talk Tools Tab */}
            {activeTab === 'ai-talk' && (
                <>
                    <div className="section-title">
                        AI Talk Tools
                        <button type="button" className="add-btn" onClick={addTool}>Add New Tool</button>
                    </div>
                    <p className="help-text">Configure tools that appear when you select text. Use [SELECTED_TEXT] as a placeholder for the selected content.</p>
                    
                    <div className="tools-list">
                        {config.aiTalkTools.map((tool, index) => (
                            <div key={tool.id} className="tool-item">
                                <div className="tool-header">
                                    <div className="tool-basic">
                                        <div className="tool-enable">
                                            <input
                                                type="checkbox"
                                                checked={tool.enabled}
                                                onChange={(e) => handleToolChange(index, 'enabled', e.target.checked)}
                                            />
                                        </div>
                                        <div className="tool-icon-input">
                                            <input
                                                type="text"
                                                value={tool.icon}
                                                onChange={(e) => handleToolChange(index, 'icon', e.target.value)}
                                                placeholder="🔧"
                                                className="icon-input"
                                            />
                                        </div>
                                        <div className="tool-name-input">
                                            <input
                                                type="text"
                                                value={tool.name}
                                                onChange={(e) => handleToolChange(index, 'name', e.target.value)}
                                                placeholder="Tool Name"
                                                className="name-input"
                                            />
                                        </div>
                                    </div>
                                    <div className="tool-actions">
                                        <button type="button" className="duplicate-btn" onClick={() => duplicateTool(index)}>
                                            📋
                                        </button>
                                        <button type="button" className="remove-btn" onClick={() => removeTool(index)}>
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="tool-prompt">
                                    <label>Prompt:</label>
                                    <textarea
                                        value={tool.prompt}
                                        onChange={(e) => handleToolChange(index, 'prompt', e.target.value)}
                                        placeholder="Enter your prompt here. Use [SELECTED_TEXT] for the selected content."
                                        className="prompt-textarea"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {config.aiTalkTools.length === 0 && (
                        <div className="empty-state">
                            <p>No AI Talk tools configured. Click "Add New Tool" to create your first tool.</p>
                        </div>
                    )}
                </>
            )}

            <button onClick={handleSave} className="save-btn">Save Settings</button>
            {status && <div className={`status ${status.type}`}>{status.message}</div>}
        </div>
    );
};

export default Options;
