// T035: Popup TypeScript controller for Shadow Tagger extension
// Handles UI interactions, state management, and communication with background/content scripts

import browser from 'webextension-polyfill';
import { messageBus, MessageType } from '../messaging/MessageBus';

interface PopupState {
  isExtensionEnabled: boolean;
  isPickerActive: boolean;
  currentPage: {
    url: string;
    title: string;
    elementCount: number;
  };
  analysisResults: any[];
  urlPattern: string;
  settings: {
    autoDetectShadowDOM: boolean;
    generateURLPatterns: boolean;
    copyToClipboard: boolean;
    showPreview: boolean;
    highlightOnHover: boolean;
  };
}

class PopupController {
  private state: PopupState;
  private elements: { [key: string]: HTMLElement } = {};
  
  constructor() {
    this.state = {
      isExtensionEnabled: true,
      isPickerActive: false,
      currentPage: {
        url: '',
        title: '',
        elementCount: 0
      },
      analysisResults: [],
      urlPattern: '',
      settings: {
        autoDetectShadowDOM: true,
        generateURLPatterns: true,
        copyToClipboard: true,
        showPreview: true,
        highlightOnHover: true
      }
    };
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      // Cache DOM elements
      this.cacheElements();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load initial state
      await this.loadState();
      
      // Update UI
      this.updateUI();
      
      console.log('Popup controller initialized');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize extension popup');
    }
  }
  
  private cacheElements(): void {
    this.elements = {
      extensionToggle: document.getElementById('extensionToggle') as HTMLInputElement,
      pageStatus: document.getElementById('pageStatus') as HTMLElement,
      elementCount: document.getElementById('elementCount') as HTMLElement,
      togglePicker: document.getElementById('togglePicker') as HTMLButtonElement,
      clearResults: document.getElementById('clearResults') as HTMLButtonElement,
      refreshResults: document.getElementById('refreshResults') as HTMLButtonElement,
      resultsContainer: document.getElementById('resultsContainer') as HTMLElement,
      emptyState: document.getElementById('emptyState') as HTMLElement,
      resultsList: document.getElementById('resultsList') as HTMLElement,
      urlPatternSection: document.getElementById('urlPatternSection') as HTMLElement,
      urlPatternDisplay: document.getElementById('urlPatternDisplay') as HTMLElement,
      copyUrlPattern: document.getElementById('copyUrlPattern') as HTMLButtonElement,
      exportData: document.getElementById('exportData') as HTMLButtonElement,
      viewHelp: document.getElementById('viewHelp') as HTMLButtonElement,
      versionNumber: document.getElementById('versionNumber') as HTMLElement,
      importFileInput: document.getElementById('importFileInput') as HTMLInputElement,
      
      // Settings
      autoDetectShadowDOM: document.getElementById('autoDetectShadowDOM') as HTMLInputElement,
      generateURLPatterns: document.getElementById('generateURLPatterns') as HTMLInputElement,
      copyToClipboard: document.getElementById('copyToClipboard') as HTMLInputElement,
      showPreview: document.getElementById('showPreview') as HTMLInputElement,
      highlightOnHover: document.getElementById('highlightOnHover') as HTMLInputElement
    };
  }
  
  private setupEventListeners(): void {
    // Extension toggle
    this.elements.extensionToggle?.addEventListener('change', this.handleExtensionToggle.bind(this));
    
    // Quick actions
    this.elements.togglePicker?.addEventListener('click', this.handleTogglePicker.bind(this));
    this.elements.clearResults?.addEventListener('click', this.handleClearResults.bind(this));
    this.elements.refreshResults?.addEventListener('click', this.handleRefreshResults.bind(this));
    
    // URL pattern actions
    this.elements.copyUrlPattern?.addEventListener('click', this.handleCopyUrlPattern.bind(this));
    
    // Footer actions
    this.elements.exportData?.addEventListener('click', this.handleExportData.bind(this));
    this.elements.viewHelp?.addEventListener('click', this.handleViewHelp.bind(this));
    
    // Settings
    this.elements.autoDetectShadowDOM?.addEventListener('change', this.handleSettingChange.bind(this));
    this.elements.generateURLPatterns?.addEventListener('change', this.handleSettingChange.bind(this));
    this.elements.copyToClipboard?.addEventListener('change', this.handleSettingChange.bind(this));
    this.elements.showPreview?.addEventListener('change', this.handleSettingChange.bind(this));
    this.elements.highlightOnHover?.addEventListener('change', this.handleSettingChange.bind(this));
    
    // File import
    this.elements.importFileInput?.addEventListener('change', this.handleFileImport.bind(this));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }
  
  private async loadState(): Promise<void> {
    try {
      // Get extension state from background
      const extensionState = await messageBus.getExtensionState();
      this.state.isExtensionEnabled = extensionState.state.isEnabled;
      this.state.settings = { ...this.state.settings, ...extensionState.state.settings };
      
      // Get current page info
      const pageInfo = await messageBus.getPageInfo();
      this.state.currentPage = pageInfo.data;
      this.state.isPickerActive = pageInfo.data.isPickerActive;
      
      // Get analysis results
      const results = await messageBus.getAnalysisResults();
      this.state.analysisResults = results.results || [];
      
    } catch (error) {
      console.error('Failed to load state:', error);
      // Continue with default state
    }
  }
  
  private updateUI(): void {
    // Update extension toggle
    if (this.elements.extensionToggle) {
      this.elements.extensionToggle.checked = this.state.isExtensionEnabled;
    }
    
    // Update page status
    if (this.elements.pageStatus) {
      this.elements.pageStatus.textContent = this.state.isExtensionEnabled ? 'Ready' : 'Disabled';
      this.elements.pageStatus.className = this.state.isExtensionEnabled ? 'status-value success' : 'status-value error';
    }
    
    // Update element count
    if (this.elements.elementCount) {
      this.elements.elementCount.textContent = this.state.currentPage.elementCount.toString();
    }
    
    // Update picker button
    if (this.elements.togglePicker) {
      this.elements.togglePicker.textContent = this.state.isPickerActive ? 'Stop Element Picker' : 'Start Element Picker';
      this.elements.togglePicker.disabled = !this.state.isExtensionEnabled;
    }
    
    // Update clear button
    if (this.elements.clearResults) {
      this.elements.clearResults.disabled = this.state.analysisResults.length === 0;
    }
    
    // Update results display
    this.updateResultsDisplay();
    
    // Update URL pattern
    this.updateUrlPatternDisplay();
    
    // Update settings
    this.updateSettingsDisplay();
    
    // Update version
    if (this.elements.versionNumber) {
      const manifest = browser.runtime.getManifest();
      this.elements.versionNumber.textContent = `v${manifest.version}`;
    }
  }
  
  private updateResultsDisplay(): void {
    const hasResults = this.state.analysisResults.length > 0;
    
    if (this.elements.emptyState) {
      this.elements.emptyState.style.display = hasResults ? 'none' : 'flex';
    }
    
    if (this.elements.resultsList) {
      this.elements.resultsList.style.display = hasResults ? 'block' : 'none';
      
      if (hasResults) {
        this.elements.resultsList.innerHTML = this.state.analysisResults
          .map((result, index) => this.createResultItemHTML(result, index))
          .join('');
        
        // Add event listeners to result items
        this.elements.resultsList.querySelectorAll('.result-copy-btn').forEach((btn, index) => {
          btn.addEventListener('click', () => this.handleCopySelector(index));
        });
        
        this.elements.resultsList.querySelectorAll('.result-highlight-btn').forEach((btn, index) => {
          btn.addEventListener('click', () => this.handleHighlightElement(index));
        });
      }
    }
  }
  
  private createResultItemHTML(result: any, index: number): string {
    const tagName = result.element?.tagName?.toLowerCase() || 'element';
    const selector = result.selector || 'No selector generated';
    const timestamp = new Date(result.timestamp).toLocaleTimeString();
    
    return `
      <div class="result-item fade-in">
        <div class="result-icon">${tagName.charAt(0).toUpperCase()}</div>
        <div class="result-content">
          <div class="result-selector" title="${selector}">${selector}</div>
          <div class="result-meta">${tagName} • ${timestamp}</div>
        </div>
        <div class="result-actions">
          <button class="icon-btn result-copy-btn" title="Copy selector">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
          <button class="icon-btn result-highlight-btn" title="Highlight element">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  
  private updateUrlPatternDisplay(): void {
    if (this.elements.urlPatternDisplay) {
      const pattern = this.state.urlPattern || 'No pattern generated';
      this.elements.urlPatternDisplay.textContent = pattern;
    }
    
    if (this.elements.copyUrlPattern) {
      this.elements.copyUrlPattern.disabled = !this.state.urlPattern;
    }
  }
  
  private updateSettingsDisplay(): void {
    if (this.elements.autoDetectShadowDOM) {
      this.elements.autoDetectShadowDOM.checked = this.state.settings.autoDetectShadowDOM;
    }
    if (this.elements.generateURLPatterns) {
      this.elements.generateURLPatterns.checked = this.state.settings.generateURLPatterns;
    }
    if (this.elements.copyToClipboard) {
      this.elements.copyToClipboard.checked = this.state.settings.copyToClipboard;
    }
    if (this.elements.showPreview) {
      this.elements.showPreview.checked = this.state.settings.showPreview;
    }
    if (this.elements.highlightOnHover) {
      this.elements.highlightOnHover.checked = this.state.settings.highlightOnHover;
    }
  }
  
  private async handleExtensionToggle(): Promise<void> {
    try {
      const result = await messageBus.toggleExtension();
      this.state.isExtensionEnabled = result.enabled;
      this.updateUI();
      
      this.showSuccess(result.enabled ? 'Extension enabled' : 'Extension disabled');
    } catch (error) {
      console.error('Failed to toggle extension:', error);
      this.showError('Failed to toggle extension');
    }
  }
  
  private async handleTogglePicker(): Promise<void> {
    try {
      this.setButtonLoading(this.elements.togglePicker, true);
      
      const result = await messageBus.toggleElementPicker();
      this.state.isPickerActive = result.active;
      
      this.updateUI();
      this.showSuccess(result.active ? 'Element picker activated' : 'Element picker deactivated');
      
      // Close popup if picker is activated
      if (result.active) {
        window.close();
      }
      
    } catch (error) {
      console.error('Failed to toggle element picker:', error);
      this.showError('Failed to toggle element picker');
    } finally {
      this.setButtonLoading(this.elements.togglePicker, false);
    }
  }
  
  private async handleClearResults(): Promise<void> {
    try {
      await messageBus.clearAnalysis();
      this.state.analysisResults = [];
      this.state.currentPage.elementCount = 0;
      this.updateUI();
      
      this.showSuccess('Analysis results cleared');
    } catch (error) {
      console.error('Failed to clear results:', error);
      this.showError('Failed to clear results');
    }
  }
  
  private async handleRefreshResults(): Promise<void> {
    try {
      this.setButtonLoading(this.elements.refreshResults, true);
      
      await this.loadState();
      this.updateUI();
      
      this.showSuccess('Results refreshed');
    } catch (error) {
      console.error('Failed to refresh results:', error);
      this.showError('Failed to refresh results');
    } finally {
      this.setButtonLoading(this.elements.refreshResults, false);
    }
  }
  
  private async handleCopySelector(index: number): Promise<void> {
    try {
      const result = this.state.analysisResults[index];
      if (result?.selector) {
        await navigator.clipboard.writeText(result.selector);
        this.showSuccess('Selector copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy selector:', error);
      this.showError('Failed to copy selector');
    }
  }
  
  private async handleHighlightElement(index: number): Promise<void> {
    try {
      // This would send a message to content script to highlight the element
      this.showSuccess('Element highlighted (feature coming soon)');
    } catch (error) {
      console.error('Failed to highlight element:', error);
      this.showError('Failed to highlight element');
    }
  }
  
  private async handleCopyUrlPattern(): Promise<void> {
    try {
      if (this.state.urlPattern) {
        await navigator.clipboard.writeText(this.state.urlPattern);
        this.showSuccess('URL pattern copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy URL pattern:', error);
      this.showError('Failed to copy URL pattern');
    }
  }
  
  private async handleSettingChange(event: Event): Promise<void> {
    try {
      const target = event.target as HTMLInputElement;
      const settingName = target.id as keyof typeof this.state.settings;
      
      this.state.settings[settingName] = target.checked;
      
      await messageBus.updateSettings({ [settingName]: target.checked });
      
      this.showSuccess('Settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      this.showError('Failed to update settings');
    }
  }
  
  private handleExportData(): void {
    // TODO: Implement data export
    this.showSuccess('Export feature coming soon');
  }
  
  private handleViewHelp(): void {
    // TODO: Open help documentation
    this.showSuccess('Help documentation coming soon');
  }
  
  private handleFileImport(): void {
    // TODO: Implement data import
    this.showSuccess('Import feature coming soon');
  }
  
  private handleKeyboard(event: KeyboardEvent): void {
    // Escape to close popup
    if (event.key === 'Escape') {
      window.close();
    }
    
    // Ctrl/Cmd + R to refresh
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      event.preventDefault();
      this.handleRefreshResults();
    }
  }
  
  private setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
    if (button) {
      button.disabled = loading;
      button.classList.toggle('loading', loading);
    }
  }
  
  private showSuccess(message: string): void {
    // TODO: Implement toast notifications
    console.log('Success:', message);
  }
  
  private showError(message: string): void {
    // TODO: Implement toast notifications
    console.error('Error:', message);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

export default PopupController;