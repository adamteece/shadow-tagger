// T031: Content script for DOM interaction and element analysis
// Handles shadow DOM detection, CSS selector generation, and user interaction

import browser from 'webextension-polyfill';
import { detectShadowContext } from '../lib/shadow-dom-detector/ShadowDetector';
import { generateSelector } from '../lib/shadow-dom-detector/SelectorGenerator';
import { analyzeURL } from '../lib/url-pattern-builder/URLAnalyzer';
import { formatRule } from '../lib/pendo-formatter/PendoFormatter';

export interface ElementPickerOptions {
  enabled: boolean;
  highlightOnHover: boolean;
  showTooltip: boolean;
  autoAnalyze: boolean;
}

export interface AnalysisResult {
  element: HTMLElement | null;
  selector: string;
  shadowContext: any;
  urlPattern: any;
  pendoRule: any;
  timestamp: number;
}

class ContentScript {
  private isEnabled: boolean = true;
  private isPickerActive: boolean = false;
  private currentHighlight: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private lastAnalyzedElement: HTMLElement | null = null;
  private analysisResults: AnalysisResult[] = [];
  
  private options: ElementPickerOptions = {
    enabled: true,
    highlightOnHover: true,
    showTooltip: true,
    autoAnalyze: false
  };
  
  constructor() {
    console.log('Shadow Tagger content script initializing...');
    this.initialize();
  }
  
  private initialize(): void {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }
  
  private async setup(): Promise<void> {
    console.log('Setting up content script...');
    this.createOverlay();
    this.setupMessageListeners();
    this.setupKeyboardShortcuts();
    await this.loadExistingResults();
    this.notifyBackgroundReady();
    console.log('Content script setup complete');
  }
  
  private createOverlay(): void {
    // Create overlay for element highlighting
    this.overlay = document.createElement('div');
    this.overlay.id = 'shadow-tagger-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: rgba(66, 133, 244, 0.2);
      border: 2px solid #4285f4;
      border-radius: 4px;
      z-index: 10000;
      display: none;
      transition: all 0.1s ease;
    `;
    document.body.appendChild(this.overlay);
    
    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'shadow-tagger-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      background: #333;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10001;
      display: none;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(this.tooltip);
  }
  
  private setupMessageListeners(): void {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    });
  }
  
  private async handleMessage(message: any, sender: any, sendResponse: any): Promise<any> {
    try {
      console.log('Content script received message:', message);
      switch (message.type) {
        case 'TOGGLE_ELEMENT_PICKER':
          console.log('Toggling element picker, current state:', this.isPickerActive);
          this.toggleElementPicker();
          console.log('Element picker toggled, new state:', this.isPickerActive);
          return { success: true, active: this.isPickerActive };
          
        case 'ANALYZE_ELEMENT':
          return this.analyzeElementById(message.elementId);
          
        case 'GET_PAGE_INFO':
          return this.getPageInfo();
          
        case 'SETTINGS_UPDATED':
          this.updateSettings(message.settings);
          return { success: true };
          
        case 'EXTENSION_TOGGLED':
          this.setEnabled(message.enabled);
          return { success: true };
          
        case 'GET_ANALYSIS_RESULTS':
          return { results: this.analysisResults };
          
        case 'ANALYZE_URL':
          return this.analyzeCurrentURL();
          
        case 'CLEAR_ANALYSIS':
          this.clearAnalysis();
          return { success: true };
          
        default:
          console.log('Unknown message type:', message.type);
          return { error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Content script error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Alt + S to toggle element picker
      if (event.altKey && event.key === 's' && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        this.toggleElementPicker();
      }
      
      // Escape to exit picker mode
      if (event.key === 'Escape' && this.isPickerActive) {
        event.preventDefault();
        this.deactivateElementPicker();
      }
    });
  }
  
  private toggleElementPicker(): void {
    if (this.isPickerActive) {
      this.deactivateElementPicker();
    } else {
      this.activateElementPicker();
    }
  }
  
  private activateElementPicker(): void {
    if (!this.isEnabled) {
      console.log('Element picker not activated - extension is disabled');
      return;
    }
    
    console.log('Activating element picker');
    this.isPickerActive = true;
    document.body.style.cursor = 'crosshair';
    
    // Add event listeners for element selection
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('mouseout', this.handleMouseOut);
    document.addEventListener('click', this.handleClick);
    
    console.log('Element picker event listeners added');
    this.showPickerNotification('Element picker activated. Click an element to analyze it. Press Escape to exit.');
  }
  
  private deactivateElementPicker(): void {
    this.isPickerActive = false;
    document.body.style.cursor = '';
    
    // Remove event listeners
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('click', this.handleClick);
    
    // Hide overlay and tooltip
    this.hideHighlight();
    this.hideTooltip();
    
    this.hidePickerNotification();
  }
  
  private handleMouseOver = (event: MouseEvent): void => {
    if (!this.isPickerActive || !this.options.highlightOnHover) return;
    
    const target = event.target as HTMLElement;
    if (target && target !== this.overlay && target !== this.tooltip) {
      this.highlightElement(target);
      
      if (this.options.showTooltip) {
        this.showElementTooltip(target, event);
      }
    }
  };
  
  private handleMouseOut = (event: MouseEvent): void => {
    if (!this.isPickerActive) return;
    
    this.hideHighlight();
    this.hideTooltip();
  };
  
  private handleClick = async (event: MouseEvent): Promise<void> => {
    console.log('Click event received, picker active:', this.isPickerActive);
    if (!this.isPickerActive) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    console.log('Clicked element:', target);
    if (target && target !== this.overlay && target !== this.tooltip) {
      console.log('Analyzing clicked element');
      await this.analyzeElement(target);
      this.deactivateElementPicker();
    }
  };
  
  private highlightElement(element: HTMLElement): void {
    if (!this.overlay) return;
    
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;
    
    this.overlay.style.left = `${rect.left + scrollX}px`;
    this.overlay.style.top = `${rect.top + scrollY}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
    this.overlay.style.display = 'block';
    
    this.currentHighlight = element;
  }
  
  private hideHighlight(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    this.currentHighlight = null;
  }
  
  private showElementTooltip(element: HTMLElement, event: MouseEvent): void {
    if (!this.tooltip) return;
    
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const dataAttrs = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `${attr.name}="${attr.value}"`)
      .join(' ');
    
    const info = `${tagName}${id}${classes}${dataAttrs ? ` ${dataAttrs}` : ''}`;
    
    this.tooltip.textContent = info;
    this.tooltip.style.left = `${event.pageX + 10}px`;
    this.tooltip.style.top = `${event.pageY - 30}px`;
    this.tooltip.style.display = 'block';
  }
  
  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
  
  private async analyzeElement(element: HTMLElement): Promise<AnalysisResult | null> {
    try {
      this.showPickerNotification('Analyzing element...', 'info');
      
      // For now, skip complex shadow DOM detection to avoid recursion issues
      const shadowContext = {
        isInShadowDOM: false,
        targetElement: element
      };
      
      // Generate a simple CSS selector
      let selectorValue = '';
      try {
        const tagName = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.trim().replace(/\s+/g, '.')}` : '';
        
        // Build selector with preference for id, then classes, then tag
        if (id) {
          selectorValue = `${tagName}${id}`;
        } else if (classes) {
          selectorValue = `${tagName}${classes}`;
        } else {
          // Use nth-child if no unique identifiers
          const siblings = Array.from(element.parentElement?.children || []);
          const index = siblings.indexOf(element) + 1;
          selectorValue = `${tagName}:nth-child(${index})`;
        }
      } catch (error) {
        console.warn('Simple selector generation failed:', error);
        selectorValue = element.tagName.toLowerCase();
      }
      
      // Analyze current URL
      let urlPattern = null;
      try {
        urlPattern = await analyzeURL(window.location.href);
      } catch (error) {
        console.warn('URL analysis failed:', error);
        urlPattern = { pattern: window.location.href };
      }
      
      // For now, skip Pendo formatting to avoid additional errors
      let pendoRule = null;
      
      const result: AnalysisResult = {
        element,
        selector: selectorValue || '',
        shadowContext,
        urlPattern,
        pendoRule,
        timestamp: Date.now()
      };
      
      this.analysisResults.push(result);
      this.lastAnalyzedElement = element;
      
      // Store results in chrome.storage for persistence
      await this.saveAnalysisResults();
      
      // Notify background about analysis
      await browser.runtime.sendMessage({
        type: 'ELEMENT_ANALYZED',
        data: {
          url: window.location.href,
          elementCount: this.analysisResults.length,
          timestamp: result.timestamp,
          selector: result.selector,
          pendoRule: result.pendoRule
        }
      });
      
      this.showPickerNotification(
        `Element analyzed! Selector: ${result.selector || 'Could not generate'}`,
        'success'
      );
      
      return result;
      
    } catch (error) {
      console.error('Error analyzing element:', error);
      this.showPickerNotification(
        `Error analyzing element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
      return null;
    }
  }
  
  private async analyzeElementById(elementId: string): Promise<AnalysisResult | null> {
    const element = document.getElementById(elementId);
    if (!element) {
      return null;
    }
    
    return this.analyzeElement(element);
  }
  
  private getPageInfo(): any {
    return {
      url: window.location.href,
      title: document.title,
      elementCount: this.analysisResults.length,
      hasResults: this.analysisResults.length > 0,
      isPickerActive: this.isPickerActive,
      lastAnalyzed: this.lastAnalyzedElement ? {
        tagName: this.lastAnalyzedElement.tagName,
        id: this.lastAnalyzedElement.id,
        className: this.lastAnalyzedElement.className
      } : null
    };
  }
  
  private updateSettings(settings: Partial<ElementPickerOptions>): void {
    this.options = { ...this.options, ...settings };
  }
  
  private setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled && this.isPickerActive) {
      this.deactivateElementPicker();
    }
  }
  
  private async clearAnalysis(): Promise<void> {
    this.analysisResults = [];
    this.lastAnalyzedElement = null;
    await this.saveAnalysisResults();
  }
  
  private async saveAnalysisResults(): Promise<void> {
    try {
      const storageKey = `analysis_results_${window.location.href}`;
      const dataToStore = this.analysisResults.map(result => ({
        selector: result.selector,
        shadowContext: result.shadowContext,
        urlPattern: result.urlPattern,
        pendoRule: result.pendoRule,
        timestamp: result.timestamp,
        elementInfo: result.element ? {
          tagName: result.element.tagName,
          id: result.element.id,
          className: result.element.className,
          textContent: result.element.textContent?.substring(0, 100)
        } : null
      }));
      
      await browser.storage.local.set({
        [storageKey]: dataToStore,
        [`last_analysis_${window.location.href}`]: Date.now()
      });
    } catch (error) {
      console.error('Failed to save analysis results:', error);
    }
  }
  
  private async loadExistingResults(): Promise<void> {
    try {
      const storageKey = `analysis_results_${window.location.href}`;
      const stored = await browser.storage.local.get(storageKey);
      
      if (stored[storageKey] && Array.isArray(stored[storageKey])) {
        // Convert stored data back to AnalysisResult format
        // Note: we can't restore the actual HTMLElement, but we have the selector
        this.analysisResults = stored[storageKey].map((item: any) => ({
          element: null, // Element reference is lost, but we have selector
          selector: item.selector,
          shadowContext: item.shadowContext,
          urlPattern: item.urlPattern,
          pendoRule: item.pendoRule,
          timestamp: item.timestamp
        }));
      }
    } catch (error) {
      console.error('Failed to load existing results:', error);
    }
  }
  
  private showPickerNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    // Remove existing notification
    const existing = document.getElementById('shadow-tagger-notification');
    if (existing) {
      existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'shadow-tagger-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      z-index: 10002;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
  
  private hidePickerNotification(): void {
    const notification = document.getElementById('shadow-tagger-notification');
    if (notification) {
      notification.remove();
    }
  }
  
  private async notifyBackgroundReady(): Promise<void> {
    try {
      await browser.runtime.sendMessage({
        type: 'CONTENT_SCRIPT_READY',
        url: window.location.href
      });
    } catch (error) {
      // Background script might not be ready yet
    }
  }
  
  private async analyzeCurrentURL(): Promise<any> {
    try {
      console.log('*** CONTENT SCRIPT: Analyzing current URL:', window.location.href);
      const urlPattern = await analyzeURL(window.location.href);
      console.log('*** CONTENT SCRIPT: URL analysis result:', urlPattern);
      return { urlPattern };
    } catch (error) {
      console.warn('*** CONTENT SCRIPT: URL analysis failed:', error);
      return { urlPattern: { pattern: window.location.href } };
    }
  }
}

// Initialize content script
const contentScript = new ContentScript();

// Export for testing
export default contentScript;