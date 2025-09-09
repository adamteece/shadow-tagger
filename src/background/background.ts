// T030: Background service worker for Chrome MV3 extension
// Handles extension lifecycle, state management, and inter-component communication

import browser from 'webextension-polyfill';

export interface ExtensionState {
  isEnabled: boolean;
  lastAnalysis: {
    url: string;
    timestamp: number;
    elementCount: number;
  } | null;
  settings: {
    autoDetectShadowDOM: boolean;
    generateURLPatterns: boolean;
    copyToClipboard: boolean;
    showPreview: boolean;
  };
}

class BackgroundService {
  private state: ExtensionState;
  
  constructor() {
    this.state = {
      isEnabled: true,
      lastAnalysis: null,
      settings: {
        autoDetectShadowDOM: true,
        generateURLPatterns: true,
        copyToClipboard: true,
        showPreview: true
      }
    };
    
    this.initializeListeners();
    this.loadState();
  }
  
  private initializeListeners(): void {
    // Extension installation/startup
    browser.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    browser.runtime.onStartup.addListener(this.handleStartup.bind(this));
    
    // Message passing
    browser.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Tab management
    browser.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    browser.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    
    // Action button click
    browser.action.onClicked.addListener(this.handleActionClick.bind(this));
  }
  
  private async handleInstalled(details: browser.Runtime.OnInstalledDetailsType): Promise<void> {
    if (details.reason === 'install') {
      console.log('Shadow Tagger extension installed');
      await this.saveState();
      
      // Set initial badge text
      await browser.action.setBadgeText({ text: '' });
      await browser.action.setBadgeBackgroundColor({ color: '#4285f4' });
    }
  }
  
  private async handleStartup(): Promise<void> {
    console.log('Shadow Tagger extension started');
    await this.loadState();
  }
  
  private async handleMessage(
    message: any,
    sender: browser.Runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<any> {
    try {
      switch (message.type) {
        case 'GET_STATE':
          return this.getState();
          
        case 'UPDATE_SETTINGS':
          await this.updateSettings(message.settings);
          return { success: true };
          
        case 'ELEMENT_ANALYZED':
          await this.handleElementAnalyzed(message.data);
          return { success: true };
          
        case 'GET_TAB_INFO':
          return this.getTabInfo(sender.tab?.id);
          
        case 'TOGGLE_EXTENSION':
          await this.toggleExtension();
          return { enabled: this.state.isEnabled };
          
        case 'CONTENT_SCRIPT_READY':
          console.log('Content script ready for tab:', sender.tab?.id);
          return { success: true };
          
        default:
          console.warn('Unknown message type:', message.type);
          return { error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  private async handleTabActivated(activeInfo: browser.Tabs.OnActivatedActiveInfoType): Promise<void> {
    // Update badge when switching tabs
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      await this.updateBadgeForTab(activeInfo.tabId);
    }
  }
  
  private async handleTabUpdated(
    tabId: number,
    changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
    tab: browser.Tabs.Tab
  ): Promise<void> {
    // Reset analysis when page changes
    if (changeInfo.status === 'complete' && tab.url) {
      if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        await this.resetAnalysisForTab(tabId);
      }
    }
  }
  
  private async handleActionClick(tab: browser.Tabs.Tab): Promise<void> {
    // Open popup (handled automatically by manifest)
    // This is a fallback for browsers that don't support popup
    if (tab.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_ELEMENT_PICKER'
      });
    }
  }
  
  private getState(): ExtensionState {
    return { ...this.state };
  }
  
  private async updateSettings(newSettings: Partial<ExtensionState['settings']>): Promise<void> {
    this.state.settings = { ...this.state.settings, ...newSettings };
    await this.saveState();
    
    // Notify all tabs about settings change
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: this.state.settings
          });
        } catch (error) {
          // Tab might not have content script injected
        }
      }
    }
  }
  
  private async handleElementAnalyzed(data: {
    url: string;
    elementCount: number;
    timestamp: number;
  }): Promise<void> {
    this.state.lastAnalysis = data;
    await this.saveState();
    
    // Update badge to show element count
    const activeTab = await this.getActiveTab();
    if (activeTab?.id) {
      await browser.action.setBadgeText({
        text: data.elementCount > 0 ? data.elementCount.toString() : '',
        tabId: activeTab.id
      });
    }
  }
  
  private async toggleExtension(): Promise<void> {
    this.state.isEnabled = !this.state.isEnabled;
    await this.saveState();
    
    // Update all tabs
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: 'EXTENSION_TOGGLED',
            enabled: this.state.isEnabled
          });
        } catch (error) {
          // Tab might not have content script injected
        }
      }
    }
    
    // Update badge
    const activeTab = await this.getActiveTab();
    if (activeTab?.id) {
      await browser.action.setBadgeText({
        text: this.state.isEnabled ? '' : 'OFF',
        tabId: activeTab.id
      });
      await browser.action.setBadgeBackgroundColor({
        color: this.state.isEnabled ? '#4285f4' : '#ea4335'
      });
    }
  }
  
  private async getTabInfo(tabId?: number): Promise<any> {
    if (!tabId) return null;
    
    try {
      const tab = await browser.tabs.get(tabId);
      return {
        url: tab.url,
        title: tab.title,
        id: tab.id
      };
    } catch (error) {
      return null;
    }
  }
  
  private async updateBadgeForTab(tabId: number): Promise<void> {
    if (!this.state.isEnabled) {
      await browser.action.setBadgeText({ text: 'OFF', tabId });
      await browser.action.setBadgeBackgroundColor({ color: '#ea4335' });
      return;
    }
    
    if (this.state.lastAnalysis) {
      await browser.action.setBadgeText({
        text: this.state.lastAnalysis.elementCount > 0 ? this.state.lastAnalysis.elementCount.toString() : '',
        tabId
      });
    } else {
      await browser.action.setBadgeText({ text: '', tabId });
    }
  }
  
  private async resetAnalysisForTab(tabId: number): Promise<void> {
    // Clear badge when navigating to new page
    await browser.action.setBadgeText({ text: '', tabId });
    
    // Clear last analysis if it's from a different URL
    const tab = await browser.tabs.get(tabId);
    if (this.state.lastAnalysis && tab.url !== this.state.lastAnalysis.url) {
      this.state.lastAnalysis = null;
      await this.saveState();
    }
  }
  
  private async getActiveTab(): Promise<browser.Tabs.Tab | null> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }
  
  private async loadState(): Promise<void> {
    try {
      const stored = await browser.storage.local.get(['shadowTaggerState']);
      if (stored.shadowTaggerState) {
        this.state = { ...this.state, ...stored.shadowTaggerState };
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }
  
  private async saveState(): Promise<void> {
    try {
      await browser.storage.local.set({
        shadowTaggerState: this.state
      });
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Export for testing
export default backgroundService;