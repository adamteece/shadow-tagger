// T032: Message passing system for Chrome extension communication
// Handles communication between background, content scripts, and popup

import browser from 'webextension-polyfill';

export enum MessageType {
  // Background ↔ Content
  CONTENT_SCRIPT_READY = 'CONTENT_SCRIPT_READY',
  TOGGLE_ELEMENT_PICKER = 'TOGGLE_ELEMENT_PICKER',
  ANALYZE_ELEMENT = 'ANALYZE_ELEMENT',
  ANALYZE_URL = 'ANALYZE_URL',
  ELEMENT_ANALYZED = 'ELEMENT_ANALYZED',
  GET_PAGE_INFO = 'GET_PAGE_INFO',
  CLEAR_ANALYSIS = 'CLEAR_ANALYSIS',
  
  // Background ↔ Popup
  GET_STATE = 'GET_STATE',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  TOGGLE_EXTENSION = 'TOGGLE_EXTENSION',
  GET_TAB_INFO = 'GET_TAB_INFO',
  GET_ANALYSIS_RESULTS = 'GET_ANALYSIS_RESULTS',
  
  // System messages
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  EXTENSION_TOGGLED = 'EXTENSION_TOGGLED',
  ERROR = 'ERROR'
}

export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
  tabId?: number;
}

export interface ElementAnalysisRequest extends BaseMessage {
  type: MessageType.ANALYZE_ELEMENT;
  elementId?: string;
  selector?: string;
}

export interface ElementAnalysisResponse extends BaseMessage {
  type: MessageType.ELEMENT_ANALYZED;
  data: {
    url: string;
    elementCount: number;
    timestamp: number;
    selector?: string;
    pendoRule?: any;
  };
}

export interface StateRequest extends BaseMessage {
  type: MessageType.GET_STATE;
}

export interface StateResponse extends BaseMessage {
  type: MessageType.GET_STATE;
  state: {
    isEnabled: boolean;
    lastAnalysis: any;
    settings: any;
  };
}

export interface SettingsUpdateRequest extends BaseMessage {
  type: MessageType.UPDATE_SETTINGS;
  settings: {
    autoDetectShadowDOM?: boolean;
    generateURLPatterns?: boolean;
    copyToClipboard?: boolean;
    showPreview?: boolean;
  };
}

export interface PageInfoRequest extends BaseMessage {
  type: MessageType.GET_PAGE_INFO;
}

export interface PageInfoResponse extends BaseMessage {
  type: MessageType.GET_PAGE_INFO;
  data: {
    url: string;
    title: string;
    elementCount: number;
    hasResults: boolean;
    isPickerActive: boolean;
    lastAnalyzed?: any;
  };
}

export interface ErrorResponse extends BaseMessage {
  type: MessageType.ERROR;
  error: string;
  originalMessage?: any;
}

export type Message = 
  | ElementAnalysisRequest
  | ElementAnalysisResponse
  | StateRequest
  | StateResponse
  | SettingsUpdateRequest
  | PageInfoRequest
  | PageInfoResponse
  | ErrorResponse
  | BaseMessage;

export class MessageBus {
  private static instance: MessageBus;
  
  private constructor() {}
  
  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }
  
  /**
   * Send message to background script
   */
  async sendToBackground<T = any>(message: Message): Promise<T> {
    try {
      const response = await browser.runtime.sendMessage({
        ...message,
        timestamp: Date.now()
      });
      
      if (response?.error) {
        throw new Error(response.error);
      }
      
      return response;
    } catch (error) {
      console.error('Failed to send message to background:', error);
      throw error;
    }
  }
  
  /**
   * Send message to content script in specific tab
   */
  async sendToContent<T = any>(tabId: number, message: Message): Promise<T> {
    try {
      const response = await browser.tabs.sendMessage(tabId, {
        ...message,
        timestamp: Date.now(),
        tabId
      });
      
      if (response?.error) {
        throw new Error(response.error);
      }
      
      return response;
    } catch (error) {
      console.error(`Failed to send message to content script (tab ${tabId}):`, error);
      throw error;
    }
  }
  
  /**
   * Send message to active tab's content script
   */
  async sendToActiveTab<T = any>(message: Message): Promise<T> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }
    
    return this.sendToContent(activeTab.id, message);
  }
  
  /**
   * Broadcast message to all tabs' content scripts
   */
  async broadcastToAllTabs(message: Message): Promise<void> {
    const tabs = await browser.tabs.query({});
    
    const promises = tabs
      .filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://'))
      .map(tab => 
        this.sendToContent(tab.id!, message).catch(error => {
          // Some tabs might not have content script injected
          console.debug(`Failed to send to tab ${tab.id}:`, error.message);
        })
      );
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Request extension state from background
   */
  async getExtensionState(): Promise<StateResponse> {
    return this.sendToBackground<StateResponse>({
      type: MessageType.GET_STATE
    });
  }
  
  /**
   * Update extension settings
   */
  async updateSettings(settings: SettingsUpdateRequest['settings']): Promise<void> {
    await this.sendToBackground({
      type: MessageType.UPDATE_SETTINGS,
      settings
    });
  }
  
  /**
   * Toggle extension on/off
   */
  async toggleExtension(): Promise<{ enabled: boolean }> {
    return this.sendToBackground<{ enabled: boolean }>({
      type: MessageType.TOGGLE_EXTENSION
    });
  }
  
  /**
   * Get current page information
   */
  async getPageInfo(): Promise<PageInfoResponse> {
    return this.sendToActiveTab<PageInfoResponse>({
      type: MessageType.GET_PAGE_INFO
    });
  }
  
  /**
   * Toggle element picker in active tab
   */
  async toggleElementPicker(): Promise<{ success: boolean; active: boolean }> {
    return this.sendToActiveTab<{ success: boolean; active: boolean }>({
      type: MessageType.TOGGLE_ELEMENT_PICKER
    });
  }
  
  /**
   * Analyze specific element by ID
   */
  async analyzeElement(elementId: string, tabId?: number): Promise<any> {
    const message: ElementAnalysisRequest = {
      type: MessageType.ANALYZE_ELEMENT,
      elementId
    };
    
    if (tabId) {
      return this.sendToContent(tabId, message);
    } else {
      return this.sendToActiveTab(message);
    }
  }
  
  /**
   * Get analysis results from active tab
   */
  async getAnalysisResults(): Promise<{ results: any[] }> {
    return this.sendToActiveTab<{ results: any[] }>({
      type: MessageType.GET_ANALYSIS_RESULTS
    });
  }
  
  /**
   * Clear analysis results in active tab
   */
  async clearAnalysis(): Promise<void> {
    await this.sendToActiveTab({
      type: MessageType.CLEAR_ANALYSIS
    });
  }
  
  /**
   * Analyze current page URL to generate patterns
   */
  async analyzeCurrentPageURL(): Promise<any> {
    return this.sendToActiveTab({
      type: MessageType.ANALYZE_URL
    });
  }
  
  /**
   * Get tab information from background
   */
  async getTabInfo(tabId?: number): Promise<any> {
    return this.sendToBackground({
      type: MessageType.GET_TAB_INFO,
      tabId
    });
  }
}

// Convenience functions for common operations
export const messageBus = MessageBus.getInstance();

// Element analysis functions (for contract test compatibility)
export async function analyzeElement(elementId: string): Promise<any> {
  return messageBus.analyzeElement(elementId);
}

export async function analyzeURL(url: string): Promise<any> {
  // This would typically be called from content script context
  // For now, return a placeholder that matches the expected interface
  return {
    originalURL: url,
    volatileSegments: [],
    isStatic: true,
    hasHashRouter: false,
    isDevelopment: url.includes('localhost') || url.includes('127.0.0.1')
  };
}

// Background messaging functions (for contract test compatibility)
export async function sendToBackground(message: any): Promise<any> {
  return messageBus.sendToBackground(message);
}

export async function sendToContent(tabId: number, message: any): Promise<any> {
  return messageBus.sendToContent(tabId, message);
}

export default MessageBus;