// T028: Element preview service
// Provides visual feedback and element information for the picker

import { DOMElement } from '../shadow-dom-detector/models/DOMElement';
import { ShadowContext } from '../shadow-dom-detector/models/ShadowContext';
import { CSSSelector } from '../shadow-dom-detector/models/CSSSelector';

export interface PreviewOptions {
  showHighlight: boolean;
  showTooltip: boolean;
  showMetadata: boolean;
  highlightColor: string;
  tooltipPosition: 'top' | 'bottom' | 'auto';
}

export interface ElementInfo {
  tagName: string;
  id: string | null;
  className: string | null;
  textContent: string;
  attributes: Record<string, string>;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  shadowInfo: {
    isInShadowDOM: boolean;
    shadowDepth: number;
    hostElements: string[];
  };
  accessibility: {
    role: string | null;
    ariaLabel: string | null;
    ariaDescribedBy: string | null;
    tabIndex: number;
  };
}

export interface PreviewState {
  isActive: boolean;
  targetElement: HTMLElement | null;
  highlightElement: HTMLElement | null;
  tooltipElement: HTMLElement | null;
  lastSelector: CSSSelector | null;
}

export class ElementPreview {
  private static instance: ElementPreview;
  private state: PreviewState;
  private defaultOptions: PreviewOptions;
  private styles: HTMLStyleElement | null;

  constructor() {
    this.state = {
      isActive: false,
      targetElement: null,
      highlightElement: null,
      tooltipElement: null,
      lastSelector: null
    };
    
    this.defaultOptions = {
      showHighlight: true,
      showTooltip: true,
      showMetadata: true,
      highlightColor: '#007ACC',
      tooltipPosition: 'auto'
    };
    
    this.styles = null;
    this.initializeStyles();
  }

  static getInstance(): ElementPreview {
    if (!ElementPreview.instance) {
      ElementPreview.instance = new ElementPreview();
    }
    return ElementPreview.instance;
  }

  /**
   * Main entry point for element preview
   * This function is called by the contract tests
   */
  async previewElement(
    element: HTMLElement,
    selector: CSSSelector | null,
    options?: Partial<PreviewOptions>
  ): Promise<ElementInfo | null> {
    if (!element) {
      return null;
    }

    const opts = { ...this.defaultOptions, ...options };

    try {
      // Get element information
      const info = this.getElementInfo(element);
      
      // Update preview state
      this.state.targetElement = element;
      this.state.lastSelector = selector;
      this.state.isActive = true;
      
      // Show visual feedback
      if (opts.showHighlight) {
        this.showHighlight(element, opts);
      }
      
      if (opts.showTooltip) {
        this.showTooltip(element, info, selector, opts);
      }
      
      return info;
    } catch (error) {
      console.error('Element preview failed:', error);
      return null;
    }
  }

  /**
   * Show hover preview without full activation
   */
  async showHoverPreview(
    element: HTMLElement,
    options?: Partial<PreviewOptions>
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };
    
    if (opts.showHighlight) {
      this.showTemporaryHighlight(element, opts);
    }
  }

  /**
   * Hide all preview elements
   */
  hidePreview(): void {
    this.removeHighlight();
    this.removeTooltip();
    
    this.state.isActive = false;
    this.state.targetElement = null;
    this.state.lastSelector = null;
  }

  /**
   * Update preview with new selector
   */
  async updateSelector(
    selector: CSSSelector,
    options?: Partial<PreviewOptions>
  ): Promise<void> {
    if (!this.state.targetElement) {
      return;
    }

    const opts = { ...this.defaultOptions, ...options };
    this.state.lastSelector = selector;
    
    // Update tooltip with new selector info
    if (opts.showTooltip && this.state.tooltipElement) {
      const info = this.getElementInfo(this.state.targetElement);
      this.updateTooltip(info, selector);
    }
  }

  /**
   * Get current preview state
   */
  getState(): PreviewState {
    return { ...this.state };
  }

  /**
   * Highlight elements matching a selector
   */
  highlightMatches(
    selector: string,
    options?: Partial<PreviewOptions>
  ): HTMLElement[] {
    const opts = { ...this.defaultOptions, ...options };
    const elements: HTMLElement[] = [];
    
    try {
      const matches = document.querySelectorAll(selector);
      matches.forEach((element, index) => {
        if (element instanceof HTMLElement) {
          elements.push(element);
          this.showMatchHighlight(element, index, opts);
        }
      });
    } catch (error) {
      console.error('Failed to highlight matches:', error);
    }
    
    return elements;
  }

  /**
   * Clear all match highlights
   */
  clearMatchHighlights(): void {
    const highlights = document.querySelectorAll('.shadow-tagger-match-highlight');
    highlights.forEach(highlight => highlight.remove());
  }

  /**
   * Get detailed element information
   */
  getElementInfo(element: HTMLElement): ElementInfo {
    const rect = element.getBoundingClientRect();
    const shadowContext = ShadowContext.create(element);
    
    // Get all attributes
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    
    // Get accessibility info
    const accessibility = {
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      ariaDescribedBy: element.getAttribute('aria-describedby'),
      tabIndex: element.tabIndex
    };
    
    // Get shadow DOM info
    const shadowInfo = {
      isInShadowDOM: shadowContext.isInShadowDOM,
      shadowDepth: shadowContext.shadowDepth,
      hostElements: shadowContext.shadowPath.map(path => 
        path.host ? `${path.host.tagName.toLowerCase()}${path.host.id ? '#' + path.host.id : ''}` : 'unknown'
      )
    };
    
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      textContent: element.textContent?.trim().substring(0, 100) || '',
      attributes,
      position: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      },
      shadowInfo,
      accessibility
    };
  }

  /**
   * Take screenshot of element (if supported)
   */
  async captureElement(
    element: HTMLElement,
    options?: {
      format: 'png' | 'jpeg';
      quality: number;
      scale: number;
    }
  ): Promise<string | null> {
    try {
      // This would require html2canvas or similar library
      // For now, return a placeholder
      console.log('Element capture would be implemented with html2canvas');
      return null;
    } catch (error) {
      console.error('Failed to capture element:', error);
      return null;
    }
  }

  /**
   * Export element information as JSON
   */
  exportElementInfo(
    element: HTMLElement,
    selector?: CSSSelector
  ): string {
    const info = this.getElementInfo(element);
    const exportData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      element: info,
      selector: selector ? {
        value: selector.value,
        specificity: selector.specificity,
        isStable: selector.isStable
      } : null
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Private methods
  private initializeStyles(): void {
    if (this.styles) {
      return;
    }
    
    this.styles = document.createElement('style');
    this.styles.textContent = `
      .shadow-tagger-highlight {
        position: absolute;
        pointer-events: none;
        border: 2px solid var(--highlight-color, #007ACC);
        background: rgba(0, 122, 204, 0.1);
        z-index: 999999;
        box-sizing: border-box;
      }
      
      .shadow-tagger-tooltip {
        position: absolute;
        background: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        z-index: 1000000;
        max-width: 300px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        white-space: pre-wrap;
      }
      
      .shadow-tagger-tooltip::before {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
      }
      
      .shadow-tagger-tooltip.top::before {
        bottom: -5px;
        left: 50%;
        margin-left: -5px;
        border-width: 5px 5px 0 5px;
        border-color: #333 transparent transparent transparent;
      }
      
      .shadow-tagger-tooltip.bottom::before {
        top: -5px;
        left: 50%;
        margin-left: -5px;
        border-width: 0 5px 5px 5px;
        border-color: transparent transparent #333 transparent;
      }
      
      .shadow-tagger-match-highlight {
        position: absolute;
        pointer-events: none;
        border: 1px dashed #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
        z-index: 999998;
        box-sizing: border-box;
      }
      
      .shadow-tagger-match-highlight::after {
        content: attr(data-match-index);
        position: absolute;
        top: -20px;
        left: 0;
        background: #ff6b6b;
        color: white;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 2px;
        font-family: monospace;
      }
    `;
    
    document.head.appendChild(this.styles);
  }

  private showHighlight(
    element: HTMLElement,
    options: PreviewOptions
  ): void {
    this.removeHighlight();
    
    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'shadow-tagger-highlight';
    highlight.style.setProperty('--highlight-color', options.highlightColor);
    highlight.style.left = `${rect.left + window.scrollX}px`;
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    
    document.body.appendChild(highlight);
    this.state.highlightElement = highlight;
  }

  private showTemporaryHighlight(
    element: HTMLElement,
    options: PreviewOptions
  ): void {
    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'shadow-tagger-highlight';
    highlight.style.setProperty('--highlight-color', options.highlightColor);
    highlight.style.left = `${rect.left + window.scrollX}px`;
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    highlight.style.opacity = '0.5';
    
    document.body.appendChild(highlight);
    
    // Remove after short delay
    setTimeout(() => {
      if (highlight.parentNode) {
        highlight.parentNode.removeChild(highlight);
      }
    }, 1000);
  }

  private showMatchHighlight(
    element: HTMLElement,
    index: number,
    options: PreviewOptions
  ): void {
    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'shadow-tagger-match-highlight';
    highlight.setAttribute('data-match-index', (index + 1).toString());
    highlight.style.left = `${rect.left + window.scrollX}px`;
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    
    document.body.appendChild(highlight);
  }

  private showTooltip(
    element: HTMLElement,
    info: ElementInfo,
    selector: CSSSelector | null,
    options: PreviewOptions
  ): void {
    this.removeTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'shadow-tagger-tooltip';
    
    const content = this.generateTooltipContent(info, selector, options);
    tooltip.textContent = content;
    
    document.body.appendChild(tooltip);
    this.state.tooltipElement = tooltip;
    
    // Position tooltip
    this.positionTooltip(tooltip, element, options);
  }

  private updateTooltip(
    info: ElementInfo,
    selector: CSSSelector
  ): void {
    if (!this.state.tooltipElement) {
      return;
    }
    
    const content = this.generateTooltipContent(info, selector, this.defaultOptions);
    this.state.tooltipElement.textContent = content;
  }

  private generateTooltipContent(
    info: ElementInfo,
    selector: CSSSelector | null,
    options: PreviewOptions
  ): string {
    const parts: string[] = [];
    
    // Basic element info
    parts.push(`Tag: ${info.tagName}`);
    
    if (info.id) {
      parts.push(`ID: ${info.id}`);
    }
    
    if (info.className) {
      parts.push(`Class: ${info.className}`);
    }
    
    if (info.textContent) {
      parts.push(`Text: ${info.textContent}`);
    }
    
    // Selector info
    if (selector) {
      parts.push('');
      parts.push(`Selector: ${selector.value}`);
      parts.push(`Specificity: ${selector.specificity}`);
      parts.push(`Stable: ${selector.isStable ? 'Yes' : 'No'}`);
    }
    
    // Shadow DOM info
    if (info.shadowInfo.isInShadowDOM) {
      parts.push('');
      parts.push(`Shadow DOM: Depth ${info.shadowInfo.shadowDepth}`);
      parts.push(`Hosts: ${info.shadowInfo.hostElements.join(' → ')}`);
    }
    
    // Accessibility info
    if (options.showMetadata) {
      if (info.accessibility.role || info.accessibility.ariaLabel) {
        parts.push('');
        if (info.accessibility.role) {
          parts.push(`Role: ${info.accessibility.role}`);
        }
        if (info.accessibility.ariaLabel) {
          parts.push(`ARIA Label: ${info.accessibility.ariaLabel}`);
        }
      }
    }
    
    return parts.join('\n');
  }

  private positionTooltip(
    tooltip: HTMLElement,
    element: HTMLElement,
    options: PreviewOptions
  ): void {
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let position = options.tooltipPosition;
    
    // Auto-position if requested
    if (position === 'auto') {
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      position = spaceAbove > spaceBelow ? 'top' : 'bottom';
    }
    
    // Calculate position
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top: number;
    
    if (position === 'top') {
      top = rect.top - tooltipRect.height - 10;
      tooltip.classList.add('top');
    } else {
      top = rect.bottom + 10;
      tooltip.classList.add('bottom');
    }
    
    // Adjust for viewport bounds
    if (left < 10) {
      left = 10;
    } else if (left + tooltipRect.width > viewportWidth - 10) {
      left = viewportWidth - tooltipRect.width - 10;
    }
    
    if (top < 10) {
      top = 10;
    } else if (top + tooltipRect.height > viewportHeight - 10) {
      top = viewportHeight - tooltipRect.height - 10;
    }
    
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
  }

  private removeHighlight(): void {
    if (this.state.highlightElement) {
      if (this.state.highlightElement.parentNode) {
        this.state.highlightElement.parentNode.removeChild(this.state.highlightElement);
      }
      this.state.highlightElement = null;
    }
  }

  private removeTooltip(): void {
    if (this.state.tooltipElement) {
      if (this.state.tooltipElement.parentNode) {
        this.state.tooltipElement.parentNode.removeChild(this.state.tooltipElement);
      }
      this.state.tooltipElement = null;
    }
  }
}

// Export the main preview function for use in tests
export async function previewElement(
  element: HTMLElement,
  selector: CSSSelector | null,
  options?: Partial<PreviewOptions>
): Promise<ElementInfo | null> {
  const preview = ElementPreview.getInstance();
  return preview.previewElement(element, selector, options);
}