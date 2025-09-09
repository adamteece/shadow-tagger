// T033: Extension state management and storage
// Centralized state management for Shadow Tagger extension

import browser from 'webextension-polyfill';

export interface ExtensionSettings {
  autoDetectShadowDOM: boolean;
  generateURLPatterns: boolean;
  copyToClipboard: boolean;
  showPreview: boolean;
  highlightOnHover: boolean;
  showTooltip: boolean;
  enableKeyboardShortcuts: boolean;
}

export interface AnalysisSession {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  elements: AnalyzedElement[];
  urlPattern?: any;
}

export interface AnalyzedElement {
  id: string;
  tagName: string;
  selector: string;
  shadowContext: any;
  pendoRule: any;
  timestamp: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExtensionState {
  isEnabled: boolean;
  version: string;
  settings: ExtensionSettings;
  currentSession: AnalysisSession | null;
  recentSessions: AnalysisSession[];
  statistics: {
    totalElementsAnalyzed: number;
    totalSessions: number;
    lastUsed: number;
    favoriteSelectors: string[];
  };
}

export class ExtensionStateManager {
  private static instance: ExtensionStateManager;
  private state: ExtensionState;
  private storageKey = 'shadowTaggerState';
  private maxRecentSessions = 10;
  private maxFavoriteSelectors = 20;
  
  private constructor() {
    this.state = this.getDefaultState();
  }
  
  static getInstance(): ExtensionStateManager {
    if (!ExtensionStateManager.instance) {
      ExtensionStateManager.instance = new ExtensionStateManager();
    }
    return ExtensionStateManager.instance;
  }
  
  private getDefaultState(): ExtensionState {
    return {
      isEnabled: true,
      version: '1.0.0',
      settings: {
        autoDetectShadowDOM: true,
        generateURLPatterns: true,
        copyToClipboard: true,
        showPreview: true,
        highlightOnHover: true,
        showTooltip: true,
        enableKeyboardShortcuts: true
      },
      currentSession: null,
      recentSessions: [],
      statistics: {
        totalElementsAnalyzed: 0,
        totalSessions: 0,
        lastUsed: Date.now(),
        favoriteSelectors: []
      }
    };
  }
  
  /**
   * Initialize state manager by loading from storage
   */
  async initialize(): Promise<void> {
    await this.loadState();
    
    // Update version if needed
    const manifest = browser.runtime.getManifest();
    if (this.state.version !== manifest.version) {
      await this.migrateState(this.state.version, manifest.version);
      this.state.version = manifest.version;
      await this.saveState();
    }
  }
  
  /**
   * Get current extension state
   */
  getState(): ExtensionState {
    return { ...this.state };
  }
  
  /**
   * Get extension settings
   */
  getSettings(): ExtensionSettings {
    return { ...this.state.settings };
  }
  
  /**
   * Update extension settings
   */
  async updateSettings(newSettings: Partial<ExtensionSettings>): Promise<void> {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.state.statistics.lastUsed = Date.now();
    await this.saveState();
  }
  
  /**
   * Toggle extension enabled state
   */
  async toggleEnabled(): Promise<boolean> {
    this.state.isEnabled = !this.state.isEnabled;
    this.state.statistics.lastUsed = Date.now();
    await this.saveState();
    return this.state.isEnabled;
  }
  
  /**
   * Set extension enabled state
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (this.state.isEnabled !== enabled) {
      this.state.isEnabled = enabled;
      this.state.statistics.lastUsed = Date.now();
      await this.saveState();
    }
  }
  
  /**
   * Start new analysis session
   */
  async startSession(url: string, title: string): Promise<AnalysisSession> {
    // End current session if exists
    if (this.state.currentSession) {
      await this.endCurrentSession();
    }
    
    const session: AnalysisSession = {
      id: this.generateSessionId(),
      url,
      title,
      timestamp: Date.now(),
      elements: []
    };
    
    this.state.currentSession = session;
    this.state.statistics.totalSessions++;
    this.state.statistics.lastUsed = Date.now();
    
    await this.saveState();
    return session;
  }
  
  /**
   * Add analyzed element to current session
   */
  async addAnalyzedElement(element: Omit<AnalyzedElement, 'id' | 'timestamp'>): Promise<void> {
    if (!this.state.currentSession) {
      // Create a session if none exists
      await this.startSession(element.position ? window.location.href : '', document.title || '');
    }
    
    const analyzedElement: AnalyzedElement = {
      ...element,
      id: this.generateElementId(),
      timestamp: Date.now()
    };
    
    this.state.currentSession!.elements.push(analyzedElement);
    this.state.statistics.totalElementsAnalyzed++;
    this.state.statistics.lastUsed = Date.now();
    
    // Add selector to favorites if not already there
    if (element.selector && !this.state.statistics.favoriteSelectors.includes(element.selector)) {
      this.state.statistics.favoriteSelectors.unshift(element.selector);
      
      // Keep only the most recent favorites
      if (this.state.statistics.favoriteSelectors.length > this.maxFavoriteSelectors) {
        this.state.statistics.favoriteSelectors = this.state.statistics.favoriteSelectors
          .slice(0, this.maxFavoriteSelectors);
      }
    }
    
    await this.saveState();
  }
  
  /**
   * Update URL pattern for current session
   */
  async updateSessionUrlPattern(urlPattern: any): Promise<void> {
    if (this.state.currentSession) {
      this.state.currentSession.urlPattern = urlPattern;
      await this.saveState();
    }
  }
  
  /**
   * End current session and move to recent sessions
   */
  async endCurrentSession(): Promise<void> {
    if (!this.state.currentSession) {
      return;
    }
    
    // Add to recent sessions
    this.state.recentSessions.unshift(this.state.currentSession);
    
    // Keep only the most recent sessions
    if (this.state.recentSessions.length > this.maxRecentSessions) {
      this.state.recentSessions = this.state.recentSessions.slice(0, this.maxRecentSessions);
    }
    
    this.state.currentSession = null;
    await this.saveState();
  }
  
  /**
   * Get current session
   */
  getCurrentSession(): AnalysisSession | null {
    return this.state.currentSession ? { ...this.state.currentSession } : null;
  }
  
  /**
   * Get recent sessions
   */
  getRecentSessions(): AnalysisSession[] {
    return [...this.state.recentSessions];
  }
  
  /**
   * Clear all analysis data
   */
  async clearAllData(): Promise<void> {
    this.state.currentSession = null;
    this.state.recentSessions = [];
    this.state.statistics.totalElementsAnalyzed = 0;
    this.state.statistics.totalSessions = 0;
    this.state.statistics.favoriteSelectors = [];
    
    await this.saveState();
  }
  
  /**
   * Get extension statistics
   */
  getStatistics() {
    return { ...this.state.statistics };
  }
  
  /**
   * Export extension data for backup
   */
  async exportData(): Promise<string> {
    const exportData = {
      version: this.state.version,
      exportTimestamp: Date.now(),
      settings: this.state.settings,
      recentSessions: this.state.recentSessions,
      statistics: this.state.statistics
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Import extension data from backup
   */
  async importData(dataJson: string): Promise<void> {
    try {
      const importData = JSON.parse(dataJson);
      
      // Validate import data structure
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data format');
      }
      
      // Merge imported data with current state
      this.state.settings = { ...this.state.settings, ...importData.settings };
      this.state.recentSessions = [...importData.recentSessions, ...this.state.recentSessions]
        .slice(0, this.maxRecentSessions);
      
      // Merge statistics
      this.state.statistics.totalElementsAnalyzed += importData.statistics?.totalElementsAnalyzed || 0;
      this.state.statistics.totalSessions += importData.statistics?.totalSessions || 0;
      
      if (importData.statistics?.favoriteSelectors) {
        this.state.statistics.favoriteSelectors = [
          ...importData.statistics.favoriteSelectors,
          ...this.state.statistics.favoriteSelectors
        ].slice(0, this.maxFavoriteSelectors);
      }
      
      await this.saveState();
      
    } catch (error) {
      throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateImportData(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           data.version &&
           data.settings &&
           typeof data.settings === 'object';
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateElementId(): string {
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async loadState(): Promise<void> {
    try {
      const stored = await browser.storage.local.get([this.storageKey]);
      if (stored[this.storageKey]) {
        // Merge with defaults to handle missing properties
        this.state = { 
          ...this.getDefaultState(), 
          ...stored[this.storageKey] 
        };
        
        // Ensure settings are complete
        this.state.settings = {
          ...this.getDefaultState().settings,
          ...this.state.settings
        };
      }
    } catch (error) {
      console.error('Error loading extension state:', error);
      // Use default state if loading fails
      this.state = this.getDefaultState();
    }
  }
  
  private async saveState(): Promise<void> {
    try {
      await browser.storage.local.set({
        [this.storageKey]: this.state
      });
    } catch (error) {
      console.error('Error saving extension state:', error);
    }
  }
  
  private async migrateState(fromVersion: string, toVersion: string): Promise<void> {
    console.log(`Migrating extension state from ${fromVersion} to ${toVersion}`);
    
    // Add migration logic here as needed for future versions
    // For now, just ensure all default settings are present
    this.state.settings = {
      ...this.getDefaultState().settings,
      ...this.state.settings
    };
  }
}

// Singleton instance
export const extensionState = ExtensionStateManager.getInstance();

export default ExtensionStateManager;