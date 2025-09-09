// T018: DOMElement model for shadow DOM detection
// Represents a DOM element with its properties and methods for analysis

export interface ElementAttributes {
  id?: string;
  className?: string;
  tagName: string;
  'data-testid'?: string;
  'aria-label'?: string;
  'data-component'?: string;
  'data-pendo'?: string;
  role?: string;
  type?: string;
  name?: string;
  [key: string]: string | undefined;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface ElementHierarchy {
  parent: DOMElement | null;
  children: DOMElement[];
  siblings: DOMElement[];
  index: number;
  depth: number;
}

export class DOMElement {
  private _element: HTMLElement;
  private _attributes: ElementAttributes;
  private _position: ElementPosition;
  private _hierarchy: ElementHierarchy;
  private _isValid: boolean;

  constructor(element: HTMLElement) {
    if (!element || !(element instanceof HTMLElement)) {
      throw new Error('Invalid element: must be an HTMLElement');
    }
    
    this._element = element;
    this._isValid = this.validateElement();
    this._attributes = this.extractAttributes();
    this._position = this.calculatePosition();
    this._hierarchy = this.analyzeHierarchy();
  }

  // Getters
  get element(): HTMLElement {
    return this._element;
  }

  get attributes(): ElementAttributes {
    return { ...this._attributes };
  }

  get position(): ElementPosition {
    return { ...this._position };
  }

  get hierarchy(): ElementHierarchy {
    return {
      ...this._hierarchy,
      parent: this._hierarchy.parent,
      children: [...this._hierarchy.children],
      siblings: [...this._hierarchy.siblings]
    };
  }

  get isValid(): boolean {
    return this._isValid;
  }

  get tagName(): string {
    return this._element.tagName.toLowerCase();
  }

  get id(): string | undefined {
    return this._attributes.id;
  }

  get className(): string | undefined {
    return this._attributes.className;
  }

  get isVisible(): boolean {
    const style = window.getComputedStyle(this._element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           this._position.width > 0 && 
           this._position.height > 0;
  }

  get isInteractive(): boolean {
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'a', 'label'];
    const hasClickHandler = this._element.onclick !== null;
    const hasTabIndex = this._element.tabIndex >= 0;
    const hasRole = ['button', 'link', 'menuitem', 'option', 'tab'].includes(
      this._attributes.role || ''
    );
    
    return interactiveTags.includes(this.tagName) || 
           hasClickHandler || 
           hasTabIndex || 
           hasRole;
  }

  // Methods
  hasAttribute(name: string): boolean {
    return this._element.hasAttribute(name);
  }

  getAttribute(name: string): string | null {
    return this._element.getAttribute(name);
  }

  getStableAttributes(): Record<string, string> {
    const stable: Record<string, string> = {};
    const stableAttributeNames = [
      'id', 'data-testid', 'data-component', 'data-pendo', 
      'aria-label', 'role', 'name', 'type'
    ];
    
    stableAttributeNames.forEach(attr => {
      const value = this.getAttribute(attr);
      if (value && value.trim()) {
        stable[attr] = value;
      }
    });
    
    return stable;
  }

  getFragileAttributes(): Record<string, string> {
    const fragile: Record<string, string> = {};
    const fragilePatterns = [
      /class.*\d+/,  // Classes with numbers
      /id.*\d{3,}/,  // IDs with 3+ digits
      /data-.*\d{6,}/, // Data attributes with 6+ digits
    ];
    
    Array.from(this._element.attributes).forEach(attr => {
      const value = attr.value;
      if (fragilePatterns.some(pattern => pattern.test(value))) {
        fragile[attr.name] = value;
      }
    });
    
    return fragile;
  }

  getTextContent(): string {
    return this._element.textContent?.trim() || '';
  }

  getInnerText(): string {
    return this._element.innerText?.trim() || '';
  }

  isDescendantOf(ancestor: HTMLElement): boolean {
    return ancestor.contains(this._element) && ancestor !== this._element;
  }

  isAncestorOf(descendant: HTMLElement): boolean {
    return this._element.contains(descendant) && this._element !== descendant;
  }

  getSelectorPriority(): number {
    let priority = 0;
    
    // High priority attributes
    if (this.id) priority += 100;
    if (this.getAttribute('data-testid')) priority += 90;
    if (this.getAttribute('data-component')) priority += 80;
    if (this.getAttribute('aria-label')) priority += 70;
    if (this.getAttribute('role')) priority += 60;
    
    // Medium priority
    if (this.className) priority += 30;
    if (this.getAttribute('name')) priority += 40;
    if (this.getAttribute('type')) priority += 35;
    
    // Interactive elements get bonus
    if (this.isInteractive) priority += 20;
    
    // Visible elements get bonus
    if (this.isVisible) priority += 10;
    
    return priority;
  }

  // Private methods
  private validateElement(): boolean {
    try {
      return this._element instanceof HTMLElement && 
             this._element.isConnected && 
             document.contains(this._element);
    } catch {
      return false;
    }
  }

  private extractAttributes(): ElementAttributes {
    const attrs: ElementAttributes = {
      tagName: this._element.tagName.toLowerCase()
    };
    
    // Extract common attributes
    if (this._element.id) attrs.id = this._element.id;
    if (this._element.className) attrs.className = this._element.className;
    
    // Extract data and aria attributes
    Array.from(this._element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
        attrs[attr.name] = attr.value;
      } else if (['role', 'type', 'name'].includes(attr.name)) {
        attrs[attr.name] = attr.value;
      }
    });
    
    return attrs;
  }

  private calculatePosition(): ElementPosition {
    const rect = this._element.getBoundingClientRect();
    
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom
    };
  }

  private analyzeHierarchy(): ElementHierarchy {
    const parent = this._element.parentElement ? 
      new DOMElement(this._element.parentElement) : null;
    
    const children = Array.from(this._element.children)
      .filter(child => child instanceof HTMLElement)
      .map(child => new DOMElement(child as HTMLElement));
    
    const siblings = parent ? 
      Array.from(parent.element.children)
        .filter(sibling => sibling instanceof HTMLElement && sibling !== this._element)
        .map(sibling => new DOMElement(sibling as HTMLElement)) : [];
    
    const index = parent ? 
      Array.from(parent.element.children).indexOf(this._element) : 0;
    
    let depth = 0;
    let current = this._element.parentElement;
    while (current) {
      depth++;
      current = current.parentElement;
    }
    
    return {
      parent,
      children,
      siblings,
      index,
      depth
    };
  }

  // Utility methods
  toString(): string {
    const attrs = [];
    if (this.id) attrs.push(`#${this.id}`);
    if (this.className) attrs.push(`.${this.className.split(' ').join('.')}`);
    
    return `${this.tagName}${attrs.join('')}`;
  }

  equals(other: DOMElement): boolean {
    return this._element === other._element;
  }

  clone(): DOMElement {
    return new DOMElement(this._element);
  }
}