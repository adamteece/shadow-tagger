// T035: Popup TypeScript controller for Shadow Tagger extension
// Handles UI interactions, state management, and communication with background/content scripts

import browser from 'webextension-polyfill';
import { messageBus, MessageType } from '../messaging/MessageBus';
import ClipboardUtils from '../utils/ClipboardUtils';

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
  private clipboard: ClipboardUtils;
  
  constructor() {
    this.clipboard = new ClipboardUtils({
      showNotification: false, // We'll handle notifications ourselves
      formatType: 'text',
      includeMetadata: false
    });
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
      
      // Tabs
      tabButtons: Array.from(document.querySelectorAll('.tab-btn')),
      featuresTab: document.getElementById('featuresTab') as HTMLElement,
      pagesTab: document.getElementById('pagesTab') as HTMLElement,
      
      // Page Rules tab elements
      currentUrlDisplay: document.getElementById('currentUrlDisplay') as HTMLElement,
      refreshUrl: document.getElementById('refreshUrl') as HTMLButtonElement,
      analyzeUrl: document.getElementById('analyzeUrl') as HTMLButtonElement,
      urlSegmentsContainer: document.getElementById('urlSegmentsContainer') as HTMLElement,
      segmentsList: document.getElementById('segmentsList') as HTMLElement,
      patternOutput: document.getElementById('patternOutput') as HTMLElement,
      copyPagePattern: document.getElementById('copyPagePattern') as HTMLButtonElement,
      matchType: document.getElementById('matchType') as HTMLElement,
      wildcardCount: document.getElementById('wildcardCount') as HTMLElement,
      
      // Settings
      autoDetectShadowDOM: document.getElementById('autoDetectShadowDOM') as HTMLInputElement,
      generateURLPatterns: document.getElementById('generateURLPatterns') as HTMLInputElement,
      copyToClipboard: document.getElementById('copyToClipboard') as HTMLInputElement,
      showPreview: document.getElementById('showPreview') as HTMLInputElement,
      highlightOnHover: document.getElementById('highlightOnHover') as HTMLInputElement
    };
  }
  
  private setupEventListeners(): void {
    // Tab switching
    this.elements.tabButtons?.forEach((btn: Element) => {
      btn.addEventListener('click', this.handleTabSwitch.bind(this));
    });
    
    // Page Rules tab actions
    this.elements.refreshUrl?.addEventListener('click', this.handleRefreshUrl.bind(this));
    this.elements.analyzeUrl?.addEventListener('click', this.handleAnalyzeUrl.bind(this));
    this.elements.copyPagePattern?.addEventListener('click', this.handleCopyPagePattern.bind(this));
    
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
      console.log('Popup loading state...');
      
      // Get extension state from background with fallback
      try {
        const extensionState = await messageBus.getExtensionState();
        console.log('Extension state response:', extensionState);
        
        if (extensionState && extensionState.state) {
          this.state.isExtensionEnabled = extensionState.state.isEnabled;
          this.state.settings = { ...this.state.settings, ...extensionState.state.settings };
        } else {
          console.log('Extension state missing, using defaults');
          this.state.isExtensionEnabled = true; // Default to enabled
        }
      } catch (error) {
        console.log('Failed to get extension state:', error);
        this.state.isExtensionEnabled = true; // Default to enabled
      }

      // Get current page info with fallback
      try {
        const pageInfo = await messageBus.getPageInfo();
        console.log('Page info response:', pageInfo);
        
        if (pageInfo && pageInfo.data) {
          this.state.currentPage = pageInfo.data;
          this.state.isPickerActive = pageInfo.data.isPickerActive;
        } else {
          console.log('Page info missing, using defaults');
          this.state.currentPage = { url: '', title: '', elementCount: 0 };
          this.state.isPickerActive = false;
        }
      } catch (error) {
        console.log('Failed to get page info:', error);
        this.state.currentPage = { url: '', title: '', elementCount: 0 };
        this.state.isPickerActive = false;
      }

      // Get current tab to find URL
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url) {
        console.log('Loading analysis results for URL:', currentTab.url);
        
        // Generate URL pattern for current page
        try {
          console.log('*** STARTING AUTOMATIC URL PATTERN GENERATION ***');
          console.log('Generating URL pattern for current page...');
          const urlAnalysisResult = await messageBus.analyzeCurrentPageURL();
          console.log('URL analysis result:', urlAnalysisResult);
          console.log('URL analysis result type:', typeof urlAnalysisResult);
          console.log('URL analysis result keys:', Object.keys(urlAnalysisResult || {}));
          
          if (urlAnalysisResult && urlAnalysisResult.urlPattern) {
            console.log('urlPattern property:', urlAnalysisResult.urlPattern);
            console.log('urlPattern type:', typeof urlAnalysisResult.urlPattern);
            console.log('urlPattern keys:', Object.keys(urlAnalysisResult.urlPattern || {}));
            
            // Log all the properties to see what's available
            const urlPatternObj = urlAnalysisResult.urlPattern;
            console.log('urlPattern._generatedPattern:', urlPatternObj._generatedPattern);
            console.log('urlPattern.pattern:', urlPatternObj.pattern);
            console.log('urlPattern.generatedPattern:', urlPatternObj.generatedPattern);
            console.log('urlPattern.volatileSegments:', urlPatternObj.volatileSegments);
            console.log('urlPattern.matchType:', urlPatternObj.matchType);
            
            // Decide which pattern to use based on usefulness
            let selectedPattern = '';
            
            if (typeof urlAnalysisResult.urlPattern === 'string') {
              selectedPattern = urlAnalysisResult.urlPattern;
              console.log('Set pattern from string:', selectedPattern);
            } else if (urlAnalysisResult.urlPattern._generatedPattern) {
              selectedPattern = urlAnalysisResult.urlPattern._generatedPattern;
              console.log('Set pattern from ._generatedPattern property:', selectedPattern);
            } else if (urlAnalysisResult.urlPattern.generatedPattern) {
              selectedPattern = urlAnalysisResult.urlPattern.generatedPattern;
              console.log('Set pattern from .generatedPattern property:', selectedPattern);
            } else if (urlAnalysisResult.urlPattern.pattern) {
              selectedPattern = urlAnalysisResult.urlPattern.pattern;
              console.log('Set pattern from .pattern property:', selectedPattern);
            }
            
            // Check if the generated pattern is too simplified (much shorter than original)
            const originalUrl = currentTab.url;
            const isOversimplified = selectedPattern && 
              (originalUrl.length - selectedPattern.length) > 50 && // Much shorter
              originalUrl.includes('#'); // Had hash parameters
            
            if (isOversimplified) {
              console.log('Generated pattern seems oversimplified, using full URL');
              console.log('Simplified pattern was:', selectedPattern);
              this.state.urlPattern = originalUrl;
            } else if (selectedPattern) {
              this.state.urlPattern = selectedPattern;
              console.log('Using generated pattern:', selectedPattern);
            } else {
              this.state.urlPattern = currentTab.url; // Fallback to current URL
              console.log('Set pattern from currentTab.url fallback:', this.state.urlPattern);
            }
          } else {
            this.state.urlPattern = currentTab.url; // Fallback to current URL
            console.log('Set pattern from final fallback:', this.state.urlPattern);
          }
          console.log('Final state.urlPattern:', this.state.urlPattern);
        } catch (error) {
          console.log('Failed to analyze URL, using current URL as pattern:', error);
          this.state.urlPattern = currentTab.url;
        }
        
        // Load analysis results from storage for current URL
        const storageKey = `analysis_results_${currentTab.url}`;
        const stored = await browser.storage.local.get(storageKey);
        
        console.log('Stored data:', stored);
        
        if (stored[storageKey] && Array.isArray(stored[storageKey])) {
          this.state.analysisResults = stored[storageKey];
          this.state.currentPage.elementCount = stored[storageKey].length;
          console.log('Loaded analysis results:', this.state.analysisResults);
        } else {
          console.log('No stored results found, trying content script...');
          // Fallback: try to get from content script
          try {
            const results = await messageBus.getAnalysisResults();
            this.state.analysisResults = results.results || [];
            console.log('Content script results:', this.state.analysisResults);
          } catch (error) {
            console.log('Content script fallback failed:', error);
            this.state.analysisResults = [];
          }
        }
      }

    } catch (error) {
      console.error('Failed to load state:', error);
      // Continue with default state
    }
  }  private updateUI(): void {
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
    console.log('Updating results display, hasResults:', hasResults, 'analysisResults:', this.state.analysisResults);
    
    if (this.elements.emptyState) {
      this.elements.emptyState.style.display = hasResults ? 'none' : 'flex';
      console.log('Empty state display:', this.elements.emptyState.style.display);
    }
    
    if (this.elements.resultsList) {
      this.elements.resultsList.style.display = hasResults ? 'block' : 'none';
      console.log('Results list display:', this.elements.resultsList.style.display);
      
      if (hasResults) {
        const htmlContent = this.state.analysisResults
          .map((result, index) => this.createResultItemHTML(result, index))
          .join('');
        console.log('Generated HTML content:', htmlContent);
        this.elements.resultsList.innerHTML = htmlContent;
        
        // Add event listeners to result items
        this.elements.resultsList.querySelectorAll('.result-copy-btn').forEach((btn, index) => {
          btn.addEventListener('click', () => this.handleCopySelector(index));
        });
        
        this.elements.resultsList.querySelectorAll('.result-highlight-btn').forEach((btn, index) => {
          btn.addEventListener('click', () => this.handleHighlightElement(index));
        });
      }
    } else {
      console.log('Results list element not found!');
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
    console.log('*** UPDATE URL PATTERN DISPLAY called ***');
    console.log('Current state.urlPattern:', this.state.urlPattern);
    console.log('Analysis results length:', this.state.analysisResults.length);
    
    // Use direct state.urlPattern if available, otherwise extract from analysis results
    let pattern = 'No pattern generated';
    
    if (this.state.urlPattern) {
      // Use the directly set URL pattern (from automatic analysis)
      pattern = this.state.urlPattern;
      console.log('Using direct state.urlPattern:', pattern);
    } else if (this.state.analysisResults.length > 0) {
      // Fallback: extract from latest analysis result (from element picking)
      const latestResult = this.state.analysisResults[this.state.analysisResults.length - 1];
      console.log('Latest analysis result:', latestResult);
      if (latestResult.urlPattern) {
        // Check if urlPattern has a pattern property or is the pattern itself
        if (typeof latestResult.urlPattern === 'string') {
          pattern = latestResult.urlPattern;
        } else if (latestResult.urlPattern.pattern) {
          pattern = latestResult.urlPattern.pattern;
        } else if (latestResult.urlPattern._generatedPattern) {
          pattern = latestResult.urlPattern._generatedPattern;
        }
        console.log('Extracted pattern from analysis result:', pattern);
      }
    }
    
    console.log('Final pattern to display:', pattern);
    
    if (this.elements.urlPatternDisplay) {
      this.elements.urlPatternDisplay.textContent = pattern;
      console.log('Set urlPatternDisplay textContent to:', pattern);
    }
    
    if (this.elements.copyUrlPattern) {
      this.elements.copyUrlPattern.disabled = pattern === 'No pattern generated';
      console.log('Set copy button disabled to:', pattern === 'No pattern generated');
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
  
  // Tab Navigation Handlers
  private handleTabSwitch(event: Event): void {
    const button = event.currentTarget as HTMLElement;
    const tabName = button.dataset.tab;
    
    if (!tabName) return;
    
    // Update tab buttons
    this.elements.tabButtons?.forEach((btn: Element) => {
      btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update tab content
    if (this.elements.featuresTab) {
      this.elements.featuresTab.classList.remove('active');
    }
    if (this.elements.pagesTab) {
      this.elements.pagesTab.classList.remove('active');
    }
    
    if (tabName === 'features' && this.elements.featuresTab) {
      this.elements.featuresTab.classList.add('active');
    } else if (tabName === 'pages' && this.elements.pagesTab) {
      this.elements.pagesTab.classList.add('active');
      // Load current URL when switching to page rules tab
      this.loadCurrentUrl();
    }
  }
  
  // Page Rules Tab Handlers
  private async loadCurrentUrl(): Promise<void> {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const url = tabs[0].url;
        this.state.currentPage.url = url;
        
        if (this.elements.currentUrlDisplay) {
          this.elements.currentUrlDisplay.textContent = url;
        }
      }
    } catch (error) {
      console.error('Failed to load current URL:', error);
      if (this.elements.currentUrlDisplay) {
        this.elements.currentUrlDisplay.textContent = 'Unable to access URL';
      }
    }
  }
  
  private async handleRefreshUrl(): Promise<void> {
    await this.loadCurrentUrl();
    this.showSuccess('URL refreshed');
  }
  
  private async handleAnalyzeUrl(): Promise<void> {
    try {
      const url = this.state.currentPage.url;
      if (!url) {
        this.showError('No URL to analyze');
        return;
      }
      
      this.setButtonLoading(this.elements.analyzeUrl, true);
      
      // Import URLAnalyzer dynamically
      const { analyzeURL } = await import('../lib/url-pattern-builder/URLAnalyzer');
      const urlPattern = await analyzeURL(url);
      
      if (urlPattern) {
        this.renderUrlSegments(urlPattern);
        this.updatePatternOutput(urlPattern);
      }
      
    } catch (error) {
      console.error('Failed to analyze URL:', error);
      this.showError('Failed to analyze URL');
    } finally {
      this.setButtonLoading(this.elements.analyzeUrl, false);
    }
  }
  
  private renderUrlSegments(urlPattern: any): void {
    if (!this.elements.urlSegmentsContainer || !this.elements.segmentsList) return;
    
    // Hide empty state
    const emptyState = this.elements.urlSegmentsContainer.querySelector('.empty-state');
    if (emptyState) {
      (emptyState as HTMLElement).style.display = 'none';
    }
    
    // Show segments list
    this.elements.segmentsList.style.display = 'flex';
    this.elements.segmentsList.innerHTML = '';
    
    // Parse URL to get all segments
    try {
      const urlObj = new URL(urlPattern.originalURL);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      pathSegments.forEach((segment, index) => {
        const volatileSegment = urlPattern.volatileSegments.find((vs: any) => vs.position === index);
        const isVolatile = !!volatileSegment;
        
        const segmentEl = document.createElement('div');
        segmentEl.className = 'segment-item' + (isVolatile ? ' volatile' : '');
        segmentEl.dataset.index = index.toString();
        
        segmentEl.innerHTML = `
          <div class="segment-header">
            <div class="segment-type">
              <span class="segment-type-badge ${isVolatile ? '' : 'stable'}">
                ${isVolatile ? volatileSegment.type : 'stable'}
              </span>
              <span>Segment ${index + 1}</span>
            </div>
          </div>
          <div class="segment-value">/${segment}</div>
          <div class="segment-controls">
            <label class="segment-toggle ${!isVolatile ? 'active' : ''}">
              <input type="radio" name="segment-${index}" value="include" ${!isVolatile ? 'checked' : ''}>
              Include
            </label>
            <label class="segment-toggle ${isVolatile ? 'active' : ''}">
              <input type="radio" name="segment-${index}" value="wildcard" ${isVolatile ? 'checked' : ''}>
              Wildcard (*)
            </label>
            <label class="segment-toggle">
              <input type="radio" name="segment-${index}" value="exclude">
              Exclude
            </label>
          </div>
        `;
        
        // Add change listeners
        const radioButtons = segmentEl.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
          radio.addEventListener('change', () => this.handleSegmentToggle(index));
        });
        
        this.elements.segmentsList!.appendChild(segmentEl);
      });
      
    } catch (error) {
      console.error('Failed to render URL segments:', error);
    }
  }
  
  private handleSegmentToggle(index: number): void {
    // Rebuild pattern when segment selection changes
    this.rebuildPatternFromSegments();
  }
  
  private async rebuildPatternFromSegments(): Promise<void> {
    try {
      const url = this.state.currentPage.url;
      if (!url) return;
      
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      // Build pattern from current segment selections
      const patternSegments: string[] = [];
      let wildcardCount = 0;
      
      pathSegments.forEach((segment, index) => {
        const segmentItem = this.elements.segmentsList?.querySelector(`[data-index="${index}"]`);
        if (!segmentItem) return;
        
        const selectedRadio = segmentItem.querySelector('input[type="radio"]:checked') as HTMLInputElement;
        const value = selectedRadio?.value;
        
        if (value === 'wildcard') {
          patternSegments.push('*');
          wildcardCount++;
        } else if (value === 'include') {
          patternSegments.push(segment);
        }
        // 'exclude' means don't add to pattern (truncate here)
      });
      
      // Build final pattern
      const pattern = `${urlObj.origin}/${patternSegments.join('/')}`;
      
      // Update output
      if (this.elements.patternOutput) {
        this.elements.patternOutput.textContent = pattern;
      }
      
      if (this.elements.matchType) {
        this.elements.matchType.textContent = wildcardCount > 0 ? 'wildcard' : 'exact';
      }
      
      if (this.elements.wildcardCount) {
        this.elements.wildcardCount.textContent = wildcardCount.toString();
      }
      
    } catch (error) {
      console.error('Failed to rebuild pattern:', error);
    }
  }
  
  private async updatePatternOutput(urlPattern: any): Promise<void> {
    try {
      // Import PendoFormatter dynamically
      const { formatForPendo } = await import('../lib/pendo-formatter/PendoFormatter');
      const pendoRule = formatForPendo(urlPattern, 'url');
      
      if (pendoRule && this.elements.patternOutput) {
        this.elements.patternOutput.textContent = pendoRule.urlPattern || pendoRule.copyableRule;
      }
      
      if (this.elements.matchType) {
        this.elements.matchType.textContent = urlPattern.matchType || 'wildcard';
      }
      
      if (this.elements.wildcardCount) {
        this.elements.wildcardCount.textContent = urlPattern.volatileSegments?.length?.toString() || '0';
      }
      
    } catch (error) {
      console.error('Failed to update pattern output:', error);
    }
  }
  
  private async handleCopyPagePattern(): Promise<void> {
    try {
      const pattern = this.elements.patternOutput?.textContent;
      if (!pattern || pattern === 'No pattern generated') {
        this.showError('No pattern to copy');
        return;
      }
      
      // Use ClipboardUtils for better cross-browser support
      const result = await this.clipboard.copyText(pattern);
      
      if (result.success) {
        this.showSuccess(`✓ Pattern copied! (${result.method})`);
        
        // Visual feedback on button
        if (this.elements.copyPagePattern) {
          const originalHTML = this.elements.copyPagePattern.innerHTML;
          this.elements.copyPagePattern.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color: #28a745;">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          `;
          this.elements.copyPagePattern.classList.add('success');
          
          setTimeout(() => {
            if (this.elements.copyPagePattern) {
              this.elements.copyPagePattern.innerHTML = originalHTML;
              this.elements.copyPagePattern.classList.remove('success');
            }
          }, 1500);
        }
      } else {
        this.showError(`Copy failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Copy pattern error:', error);
      this.showError('Failed to copy pattern');
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
      console.log('Popup: handleTogglePicker called, current state:', this.state.isPickerActive);
      this.setButtonLoading(this.elements.togglePicker, true);
      
      console.log('Popup: sending toggle element picker message...');
      const result = await messageBus.toggleElementPicker();
      console.log('Popup: received toggle result:', result);
      
      if (result && typeof result.active === 'boolean') {
        this.state.isPickerActive = result.active;
        console.log('Popup: updated picker state to:', this.state.isPickerActive);
        
        this.updateUI();
        this.showSuccess(result.active ? 'Element picker activated' : 'Element picker deactivated');
        
        // Close popup if picker is activated
        if (result.active) {
          console.log('Popup: closing window since picker is active');
          setTimeout(() => window.close(), 100); // Small delay to ensure message is sent
        }
      } else {
        console.error('Popup: Invalid result from toggleElementPicker:', result);
        this.showError('Failed to toggle element picker');
      }
      
    } catch (error) {
      console.error('Popup: Failed to toggle element picker:', error);
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
      if (!result?.selector) {
        this.showError('No selector available');
        return;
      }
      
      // Copy selector using ClipboardUtils
      const copyResult = await this.clipboard.copyText(result.selector);
      
      if (copyResult.success) {
        this.showSuccess(`✓ Selector copied! (${copyResult.method})`);
        
        // Visual feedback on the button
        const button = document.querySelectorAll('.result-copy-btn')[index] as HTMLElement;
        if (button) {
          const originalHTML = button.innerHTML;
          button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color: #28a745;">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          `;
          button.style.background = '#d4edda';
          
          setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = '';
          }, 1500);
        }
      } else {
        this.showError(`Copy failed: ${copyResult.error || 'Unknown error'}`);
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
      if (!this.state.urlPattern) {
        this.showError('No URL pattern available');
        return;
      }
      
      const result = await this.clipboard.copyText(this.state.urlPattern);
      
      if (result.success) {
        this.showSuccess(`✓ URL pattern copied! (${result.method})`);
      } else {
        this.showError(`Copy failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Copy error:', error);
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

export { PopupController };
export default PopupController;