// T037: Copy-to-clipboard functionality for Shadow Tagger extension
// Provides secure clipboard operations with fallbacks and user feedback

export interface ClipboardOptions {
  showNotification: boolean;
  notificationDuration: number;
  fallbackEnabled: boolean;
  formatType: 'text' | 'html' | 'json' | 'csv';
  includeMetadata: boolean;
}

export interface ClipboardResult {
  success: boolean;
  method: 'navigator' | 'execCommand' | 'fallback';
  error?: string;
  data?: string;
}

export interface ElementData {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: { [key: string]: string };
  selector: string;
  xpath?: string;
  shadowInfo?: {
    isInShadowDOM: boolean;
    hostElement?: string;
    shadowDepth?: number;
  };
  pendoData?: {
    [key: string]: any;
  };
}

export class ClipboardUtils {
  private options: ClipboardOptions = {
    showNotification: true,
    notificationDuration: 2000,
    fallbackEnabled: true,
    formatType: 'text',
    includeMetadata: true
  };
  
  private notificationElement: HTMLElement | null = null;
  
  constructor(customOptions?: Partial<ClipboardOptions>) {
    if (customOptions) {
      this.options = { ...this.options, ...customOptions };
    }
  }
  
  /**
   * Copy text to clipboard with automatic method detection
   */
  async copyText(text: string): Promise<ClipboardResult> {
    if (!text) {
      return {
        success: false,
        method: 'navigator',
        error: 'No text provided'
      };
    }
    
    // Try modern Clipboard API first
    if (this.isClipboardAPISupported()) {
      try {
        await navigator.clipboard.writeText(text);
        
        if (this.options.showNotification) {
          this.showNotification('Copied to clipboard!');
        }
        
        return {
          success: true,
          method: 'navigator',
          data: text
        };
      } catch (error) {
        console.warn('Clipboard API failed, trying fallback:', error);
      }
    }
    
    // Fallback to execCommand
    if (this.options.fallbackEnabled) {
      const result = this.copyTextFallback(text);
      
      if (result.success && this.options.showNotification) {
        this.showNotification('Copied to clipboard!');
      }
      
      return result;
    }
    
    return {
      success: false,
      method: 'navigator',
      error: 'Clipboard access not available'
    };
  }
  
  /**
   * Copy element data in specified format
   */
  async copyElementData(elementData: ElementData): Promise<ClipboardResult> {
    try {
      let formattedData: string;
      
      switch (this.options.formatType) {
        case 'json':
          formattedData = this.formatAsJSON(elementData);
          break;
        case 'html':
          formattedData = this.formatAsHTML(elementData);
          break;
        case 'csv':
          formattedData = this.formatAsCSV(elementData);
          break;
        case 'text':
        default:
          formattedData = this.formatAsText(elementData);
          break;
      }
      
      return await this.copyText(formattedData);
    } catch (error) {
      return {
        success: false,
        method: 'navigator',
        error: `Failed to format data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Copy multiple elements as a formatted list
   */
  async copyElementList(elements: ElementData[]): Promise<ClipboardResult> {
    if (!elements || elements.length === 0) {
      return {
        success: false,
        method: 'navigator',
        error: 'No elements provided'
      };
    }
    
    try {
      let formattedData: string;
      
      switch (this.options.formatType) {
        case 'json':
          formattedData = JSON.stringify(elements, null, 2);
          break;
        case 'csv':
          formattedData = this.formatListAsCSV(elements);
          break;
        case 'html':
          formattedData = this.formatListAsHTML(elements);
          break;
        case 'text':
        default:
          formattedData = this.formatListAsText(elements);
          break;
      }
      
      const result = await this.copyText(formattedData);
      
      if (result.success && this.options.showNotification) {
        this.showNotification(`Copied ${elements.length} element(s) to clipboard!`);
        return result;
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        method: 'navigator',
        error: `Failed to format element list: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Check if modern Clipboard API is supported
   */
  private isClipboardAPISupported(): boolean {
    return !!(
      navigator &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function' &&
      window.isSecureContext
    );
  }
  
  /**
   * Fallback clipboard copy using execCommand
   */
  private copyTextFallback(text: string): ClipboardResult {
    try {
      // Create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        opacity: 0;
        pointer-events: none;
      `;
      
      document.body.appendChild(textarea);
      
      // Select and copy
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      
      const success = document.execCommand('copy');
      
      // Cleanup
      document.body.removeChild(textarea);
      
      if (success) {
        return {
          success: true,
          method: 'execCommand',
          data: text
        };
      } else {
        return {
          success: false,
          method: 'execCommand',
          error: 'execCommand copy failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        method: 'execCommand',
        error: `Fallback copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Format element data as plain text
   */
  private formatAsText(elementData: ElementData): string {
    const lines: string[] = [];
    
    lines.push(`Tag: ${elementData.tagName}`);
    
    if (elementData.id) {
      lines.push(`ID: ${elementData.id}`);
    }
    
    if (elementData.className) {
      lines.push(`Class: ${elementData.className}`);
    }
    
    lines.push(`Selector: ${elementData.selector}`);
    
    if (elementData.xpath) {
      lines.push(`XPath: ${elementData.xpath}`);
    }
    
    if (elementData.textContent && elementData.textContent.trim()) {
      const text = elementData.textContent.trim();
      lines.push(`Text: ${text.length > 100 ? text.substring(0, 100) + '...' : text}`);
    }
    
    // Add attributes
    const attrs = Object.entries(elementData.attributes);
    if (attrs.length > 0) {
      lines.push('\nAttributes:');
      for (const [key, value] of attrs) {
        lines.push(`  ${key}: ${value}`);
      }
    }
    
    // Add shadow DOM info
    if (elementData.shadowInfo?.isInShadowDOM) {
      lines.push('\nShadow DOM:');
      lines.push(`  Depth: ${elementData.shadowInfo.shadowDepth}`);
      if (elementData.shadowInfo.hostElement) {
        lines.push(`  Host: ${elementData.shadowInfo.hostElement}`);
      }
    }
    
    // Add Pendo data
    if (elementData.pendoData && Object.keys(elementData.pendoData).length > 0) {
      lines.push('\nPendo Data:');
      for (const [key, value] of Object.entries(elementData.pendoData)) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
    }
    
    if (this.options.includeMetadata) {
      lines.push(`\nCopied at: ${new Date().toISOString()}`);
      lines.push('Generated by Shadow Tagger Extension');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format element data as JSON
   */
  private formatAsJSON(elementData: ElementData): string {
    const data = { ...elementData };
    
    if (this.options.includeMetadata) {
      (data as any).metadata = {
        copiedAt: new Date().toISOString(),
        generatedBy: 'Shadow Tagger Extension'
      };
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Format element data as HTML
   */
  private formatAsHTML(elementData: ElementData): string {
    const escapeHtml = (text: string) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    let html = '<div class="element-data">\n';
    html += `  <h3>Element: &lt;${escapeHtml(elementData.tagName)}&gt;</h3>\n`;
    
    if (elementData.id) {
      html += `  <p><strong>ID:</strong> ${escapeHtml(elementData.id)}</p>\n`;
    }
    
    if (elementData.className) {
      html += `  <p><strong>Class:</strong> ${escapeHtml(elementData.className)}</p>\n`;
    }
    
    html += `  <p><strong>Selector:</strong> <code>${escapeHtml(elementData.selector)}</code></p>\n`;
    
    if (elementData.xpath) {
      html += `  <p><strong>XPath:</strong> <code>${escapeHtml(elementData.xpath)}</code></p>\n`;
    }
    
    const attrs = Object.entries(elementData.attributes);
    if (attrs.length > 0) {
      html += '  <h4>Attributes:</h4>\n';
      html += '  <ul>\n';
      for (const [key, value] of attrs) {
        html += `    <li><code>${escapeHtml(key)}</code>: ${escapeHtml(value)}</li>\n`;
      }
      html += '  </ul>\n';
    }
    
    if (elementData.shadowInfo?.isInShadowDOM) {
      html += '  <h4>Shadow DOM:</h4>\n';
      html += `  <p>Depth: ${elementData.shadowInfo.shadowDepth}</p>\n`;
      if (elementData.shadowInfo.hostElement) {
        html += `  <p>Host: <code>${escapeHtml(elementData.shadowInfo.hostElement)}</code></p>\n`;
      }
    }
    
    html += '</div>';
    
    if (this.options.includeMetadata) {
      html += `\n<!-- Copied at: ${new Date().toISOString()} -->\n`;
      html += '<!-- Generated by Shadow Tagger Extension -->';
    }
    
    return html;
  }
  
  /**
   * Format element data as CSV row
   */
  private formatAsCSV(elementData: ElementData): string {
    const escapeCsv = (text: string | undefined) => {
      if (!text) return '';
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    
    const values = [
      escapeCsv(elementData.tagName),
      escapeCsv(elementData.id),
      escapeCsv(elementData.className),
      escapeCsv(elementData.selector),
      escapeCsv(elementData.xpath),
      escapeCsv(elementData.textContent?.substring(0, 100)),
      escapeCsv(JSON.stringify(elementData.attributes)),
      escapeCsv(elementData.shadowInfo?.isInShadowDOM ? 'Yes' : 'No'),
      escapeCsv(elementData.shadowInfo?.hostElement),
      escapeCsv(elementData.pendoData ? JSON.stringify(elementData.pendoData) : '')
    ];
    
    const header = 'TagName,ID,ClassName,Selector,XPath,TextContent,Attributes,InShadowDOM,ShadowHost,PendoData';
    
    return this.options.includeMetadata 
      ? `${header}\n${values.join(',')}\n# Copied at: ${new Date().toISOString()}\n# Generated by Shadow Tagger Extension`
      : `${header}\n${values.join(',')}`;
  }
  
  /**
   * Format list of elements as text
   */
  private formatListAsText(elements: ElementData[]): string {
    const sections = elements.map((element, index) => {
      const formatted = this.formatAsText(element);
      return `--- Element ${index + 1} ---\n${formatted}`;
    });
    
    return sections.join('\n\n');
  }
  
  /**
   * Format list of elements as CSV
   */
  private formatListAsCSV(elements: ElementData[]): string {
    if (elements.length === 0) return '';
    
    const header = 'TagName,ID,ClassName,Selector,XPath,TextContent,Attributes,InShadowDOM,ShadowHost,PendoData';
    const rows = elements.map(element => this.formatAsCSV(element).split('\n')[1]);
    
    let csv = `${header}\n${rows.join('\n')}`;
    
    if (this.options.includeMetadata) {
      csv += `\n# Copied at: ${new Date().toISOString()}\n# Generated by Shadow Tagger Extension`;
    }
    
    return csv;
  }
  
  /**
   * Format list of elements as HTML
   */
  private formatListAsHTML(elements: ElementData[]): string {
    let html = '<div class="element-list">\n';
    html += `<h2>Element Analysis Results (${elements.length} elements)</h2>\n`;
    
    elements.forEach((element, index) => {
      html += `<div class="element-item" data-index="${index}">\n`;
      html += `<h3>Element ${index + 1}</h3>\n`;
      html += this.formatAsHTML(element);
      html += '</div>\n\n';
    });
    
    html += '</div>';
    
    if (this.options.includeMetadata) {
      html += `\n<!-- Copied at: ${new Date().toISOString()} -->\n`;
      html += '<!-- Generated by Shadow Tagger Extension -->';
    }
    
    return html;
  }
  
  /**
   * Show notification to user
   */
  private showNotification(message: string): void {
    // Remove existing notification
    this.hideNotification();
    
    // Create notification element
    this.notificationElement = document.createElement('div');
    this.notificationElement.textContent = message;
    this.notificationElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2d3748;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transform: translateY(-10px);
      transition: all 200ms ease;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.notificationElement);
    
    // Animate in
    requestAnimationFrame(() => {
      if (this.notificationElement) {
        this.notificationElement.style.opacity = '1';
        this.notificationElement.style.transform = 'translateY(0)';
      }
    });
    
    // Auto-hide after duration
    setTimeout(() => {
      this.hideNotification();
    }, this.options.notificationDuration);
  }
  
  /**
   * Hide notification
   */
  private hideNotification(): void {
    if (this.notificationElement) {
      this.notificationElement.style.opacity = '0';
      this.notificationElement.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        if (this.notificationElement && this.notificationElement.parentNode) {
          this.notificationElement.parentNode.removeChild(this.notificationElement);
        }
        this.notificationElement = null;
      }, 200);
    }
  }
  
  /**
   * Update clipboard options
   */
  updateOptions(newOptions: Partial<ClipboardOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
  
  /**
   * Get current options
   */
  getOptions(): ClipboardOptions {
    return { ...this.options };
  }
  
  /**
   * Test clipboard functionality
   */
  async testClipboard(): Promise<ClipboardResult> {
    const testText = 'Shadow Tagger clipboard test';
    return await this.copyText(testText);
  }
}

export default ClipboardUtils;