// T036: DOM overlay for element highlighting in Shadow Tagger extension
// Provides visual feedback for element selection and analysis

export interface OverlayOptions {
  highlightColor: string;
  highlightOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  zIndex: number;
  animationDuration: number;
  showTooltip: boolean;
  tooltipPosition: 'top' | 'bottom' | 'auto';
}

export interface TooltipData {
  tagName: string;
  id?: string;
  className?: string;
  attributes?: { [key: string]: string };
  shadowInfo?: {
    isInShadowDOM: boolean;
    hostElement?: string;
    shadowDepth?: number;
  };
}

export class ElementOverlay {
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private isActive: boolean = false;
  private animationFrame: number | null = null;
  
  private options: OverlayOptions = {
    highlightColor: 'rgba(66, 133, 244, 0.2)',
    highlightOpacity: 0.2,
    borderColor: '#4285f4',
    borderWidth: 2,
    borderStyle: 'solid',
    zIndex: 10000,
    animationDuration: 200,
    showTooltip: true,
    tooltipPosition: 'auto'
  };
  
  constructor(customOptions?: Partial<OverlayOptions>) {
    if (customOptions) {
      this.options = { ...this.options, ...customOptions };
    }
    
    this.createOverlayElements();
    this.setupStyles();
  }
  
  private createOverlayElements(): void {
    // Create highlight overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'shadow-tagger-element-overlay';
    this.overlay.setAttribute('data-shadow-tagger', 'overlay');
    
    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'shadow-tagger-element-tooltip';
    this.tooltip.setAttribute('data-shadow-tagger', 'tooltip');
    
    // Add to DOM
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);
  }
  
  private setupStyles(): void {
    if (!this.overlay || !this.tooltip) return;
    
    // Overlay styles
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: ${this.options.highlightColor};
      border: ${this.options.borderWidth}px ${this.options.borderStyle} ${this.options.borderColor};
      border-radius: 4px;
      z-index: ${this.options.zIndex};
      display: none;
      transition: all ${this.options.animationDuration}ms ease;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
    `;
    
    // Tooltip styles
    this.tooltip.style.cssText = `
      position: absolute;
      background: #2d3748;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      z-index: ${this.options.zIndex + 1};
      display: none;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transform: translateY(4px);
      transition: all ${this.options.animationDuration}ms ease;
    `;
    
    // Add arrow to tooltip
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #2d3748;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
    `;
    this.tooltip.appendChild(arrow);
  }
  
  /**
   * Highlight a specific element
   */
  highlightElement(element: HTMLElement, tooltipData?: TooltipData): void {
    if (!this.overlay || !element) return;
    
    this.currentTarget = element;
    
    // Update overlay position and size
    this.updateOverlayPosition(element);
    
    // Show overlay
    this.showOverlay();
    
    // Update tooltip if enabled
    if (this.options.showTooltip && this.tooltip) {
      this.updateTooltip(element, tooltipData);
      this.showTooltip();
    }
  }
  
  /**
   * Highlight element with animation
   */
  highlightElementAnimated(element: HTMLElement, tooltipData?: TooltipData): void {
    this.highlightElement(element, tooltipData);
    
    if (this.overlay) {
      // Add pulse animation
      this.overlay.style.animation = 'shadow-tagger-pulse 1s ease-in-out';
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.style.animation = '';
        }
      }, 1000);
    }
  }
  
  /**
   * Update overlay position to match target element
   */
  private updateOverlayPosition(element: HTMLElement): void {
    if (!this.overlay) return;
    
    // Cancel any pending animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      if (this.overlay) {
        this.overlay.style.left = `${rect.left + scrollX}px`;
        this.overlay.style.top = `${rect.top + scrollY}px`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
      }
    });
  }
  
  /**
   * Update tooltip content and position
   */
  private updateTooltip(element: HTMLElement, tooltipData?: TooltipData): void {
    if (!this.tooltip) return;
    
    const data = tooltipData || this.extractElementData(element);
    const content = this.generateTooltipContent(data);
    
    // Clear existing content (except arrow)
    const arrow = this.tooltip.querySelector('div');
    this.tooltip.innerHTML = content;
    if (arrow) {
      this.tooltip.appendChild(arrow);
    }
    
    // Position tooltip
    this.positionTooltip(element);
  }
  
  /**
   * Extract data from element for tooltip
   */
  private extractElementData(element: HTMLElement): TooltipData {
    const data: TooltipData = {
      tagName: element.tagName.toLowerCase()
    };
    
    if (element.id) {
      data.id = element.id;
    }
    
    if (element.className) {
      data.className = element.className;
    }
    
    // Extract interesting attributes
    const interestingAttrs = [
      'data-testid', 'data-test', 'aria-label', 'aria-labelledby',
      'data-component', 'data-pendo', 'role', 'type', 'name'
    ];
    
    data.attributes = {};
    for (const attr of interestingAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        data.attributes[attr] = value;
      }
    }
    
    // Check for shadow DOM
    data.shadowInfo = this.analyzeShadowContext(element);
    
    return data;
  }
  
  /**
   * Analyze shadow DOM context for element
   */
  private analyzeShadowContext(element: HTMLElement) {
    let current: Node | null = element;
    let shadowDepth = 0;
    let hostElement: string | undefined;
    
    while (current) {
      const parent: Node | null = current.parentNode;
      
      if (parent && (parent as any).host) {
        // We're in a shadow root
        shadowDepth++;
        const host = (parent as any).host as HTMLElement;
        if (!hostElement) {
          hostElement = this.getElementSelector(host);
        }
      }
      
      current = parent;
    }
    
    return {
      isInShadowDOM: shadowDepth > 0,
      hostElement,
      shadowDepth: shadowDepth || undefined
    };
  }
  
  /**
   * Generate a simple selector for an element
   */
  private getElementSelector(element: HTMLElement): string {
    const parts: string[] = [];
    
    parts.push(element.tagName.toLowerCase());
    
    if (element.id) {
      parts.push(`#${element.id}`);
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        parts.push(`.${classes.join('.')}`);
      }
    }
    
    return parts.join('');
  }
  
  /**
   * Generate HTML content for tooltip
   */
  private generateTooltipContent(data: TooltipData): string {
    let content = `<div style="font-weight: 600; margin-bottom: 4px;">&lt;${data.tagName}&gt;</div>`;
    
    if (data.id) {
      content += `<div style="color: #81c784;">id: "${data.id}"</div>`;
    }
    
    if (data.className) {
      const classes = data.className.split(' ').filter(c => c.trim()).slice(0, 3);
      content += `<div style="color: #64b5f6;">class: "${classes.join(' ')}"${classes.length < data.className.split(' ').length ? '...' : ''}</div>`;
    }
    
    if (data.attributes && Object.keys(data.attributes).length > 0) {
      const attrs = Object.entries(data.attributes).slice(0, 2);
      for (const [key, value] of attrs) {
        content += `<div style="color: #ffb74d;">${key}: "${value.length > 20 ? value.substring(0, 20) + '...' : value}"</div>`;
      }
    }
    
    if (data.shadowInfo?.isInShadowDOM) {
      content += `<div style="color: #f06292; margin-top: 4px;">⚡ Shadow DOM (depth: ${data.shadowInfo.shadowDepth})</div>`;
      if (data.shadowInfo.hostElement) {
        content += `<div style="color: #ba68c8; font-size: 11px;">Host: ${data.shadowInfo.hostElement}</div>`;
      }
    }
    
    return content;
  }
  
  /**
   * Position tooltip relative to target element
   */
  private positionTooltip(element: HTMLElement): void {
    if (!this.tooltip) return;
    
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);
    let top: number;
    
    // Determine if tooltip should be above or below element
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const tooltipHeight = tooltipRect.height;
    
    if (this.options.tooltipPosition === 'top' || 
        (this.options.tooltipPosition === 'auto' && spaceAbove > tooltipHeight + 10 && spaceAbove > spaceBelow)) {
      // Position above
      top = rect.top + scrollY - tooltipHeight - 10;
      this.updateArrowPosition('bottom');
    } else {
      // Position below
      top = rect.bottom + scrollY + 10;
      this.updateArrowPosition('top');
    }
    
    // Keep tooltip within viewport bounds
    if (left < 10) {
      left = 10;
    } else if (left + tooltipRect.width > viewportWidth - 10) {
      left = viewportWidth - tooltipRect.width - 10;
    }
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }
  
  /**
   * Update arrow position for tooltip
   */
  private updateArrowPosition(position: 'top' | 'bottom'): void {
    if (!this.tooltip) return;
    
    const arrow = this.tooltip.querySelector('div') as HTMLElement;
    if (!arrow) return;
    
    if (position === 'top') {
      arrow.style.borderTop = '6px solid #2d3748';
      arrow.style.borderBottom = 'none';
      arrow.style.top = '-6px';
      arrow.style.bottom = 'auto';
    } else {
      arrow.style.borderBottom = '6px solid #2d3748';
      arrow.style.borderTop = 'none';
      arrow.style.bottom = '-6px';
      arrow.style.top = 'auto';
    }
  }
  
  /**
   * Show overlay with animation
   */
  private showOverlay(): void {
    if (!this.overlay) return;
    
    this.overlay.style.display = 'block';
    this.overlay.style.opacity = '0';
    
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
    });
    
    this.isActive = true;
  }
  
  /**
   * Show tooltip with animation
   */
  private showTooltip(): void {
    if (!this.tooltip) return;
    
    this.tooltip.style.display = 'block';
    
    requestAnimationFrame(() => {
      if (this.tooltip) {
        this.tooltip.style.opacity = '1';
        this.tooltip.style.transform = 'translateY(0)';
      }
    });
  }
  
  /**
   * Hide overlay and tooltip
   */
  hideOverlay(): void {
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.style.display = 'none';
        }
      }, this.options.animationDuration);
    }
    
    if (this.tooltip) {
      this.tooltip.style.opacity = '0';
      this.tooltip.style.transform = 'translateY(4px)';
      setTimeout(() => {
        if (this.tooltip) {
          this.tooltip.style.display = 'none';
        }
      }, this.options.animationDuration);
    }
    
    this.currentTarget = null;
    this.isActive = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  /**
   * Update overlay position if target is still visible
   */
  updatePosition(): void {
    if (this.currentTarget && this.isActive) {
      this.updateOverlayPosition(this.currentTarget);
      if (this.options.showTooltip) {
        this.positionTooltip(this.currentTarget);
      }
    }
  }
  
  /**
   * Update overlay options
   */
  updateOptions(newOptions: Partial<OverlayOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.setupStyles();
  }
  
  /**
   * Check if overlay is currently active
   */
  isOverlayActive(): boolean {
    return this.isActive;
  }
  
  /**
   * Get current target element
   */
  getCurrentTarget(): HTMLElement | null {
    return this.currentTarget;
  }
  
  /**
   * Cleanup overlay elements
   */
  destroy(): void {
    this.hideOverlay();
    
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    
    this.overlay = null;
    this.tooltip = null;
    this.currentTarget = null;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

// CSS animations (injected as style)
const overlayStyles = `
  @keyframes shadow-tagger-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.02);
      opacity: 0.8;
    }
  }
`;

// Inject styles
const styleElement = document.createElement('style');
styleElement.textContent = overlayStyles;
document.head.appendChild(styleElement);

export default ElementOverlay;