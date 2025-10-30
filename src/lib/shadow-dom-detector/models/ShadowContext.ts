// T019: ShadowContext model for shadow DOM analysis
// Represents the shadow DOM context and path for an element

import { DOMElement } from './DOMElement';

export interface ShadowRootInfo {
  mode: 'open' | 'closed';
  host: HTMLElement;
  delegatesFocus: boolean;
  slotAssignment?: 'named' | 'manual';
  clonable?: boolean;
}

export interface ShadowPath {
  root: ShadowRoot;
  host: DOMElement;
  depth: number;
  mode: 'open' | 'closed';
  accessible: boolean;
}

export interface ShadowTraversalResult {
  found: boolean;
  path: ShadowPath[];
  finalHost: DOMElement | null;
  deepestRoot: ShadowRoot | null;
  totalDepth: number;
}

export class ShadowContext {
  private _isInShadowDOM: boolean;
  private _targetElement: DOMElement;
  private _hostElement: DOMElement | null;
  private _shadowPath: ShadowPath[];
  private _traversalResult: ShadowTraversalResult;
  private _rootElement: HTMLElement;

  constructor(params: {
    isInShadowDOM: boolean;
    targetElement: DOMElement;
    hostElement: DOMElement | null;
    shadowPath: ShadowRoot[];
  }) {
    this._targetElement = params.targetElement;
    this._isInShadowDOM = params.isInShadowDOM;
    this._hostElement = params.hostElement;
    this._rootElement = document.documentElement;
    
    // Convert simple ShadowRoot array to detailed ShadowPath array
    this._shadowPath = this.buildShadowPath(params.shadowPath);
    this._traversalResult = this.analyzeTraversal();
  }

  // Static factory method for easier creation
  static create(targetElement: HTMLElement): ShadowContext {
    const domElement = new DOMElement(targetElement);
    const traversal = ShadowContext.traverseShadowDOM(targetElement);
    
    return new ShadowContext({
      isInShadowDOM: traversal.found,
      targetElement: domElement,
      hostElement: traversal.finalHost,
      shadowPath: traversal.path.map(p => p.root)
    });
  }

  // Getters
  get isInShadowDOM(): boolean {
    return this._isInShadowDOM;
  }

  get targetElement(): DOMElement {
    return this._targetElement;
  }

  get hostElement(): DOMElement | null {
    return this._hostElement;
  }

  get shadowPath(): ShadowRoot[] {
    return this._shadowPath.map(path => path.root);
  }

  get shadowPathDetailed(): ShadowPath[] {
    return [...this._shadowPath];
  }

  get rootElement(): HTMLElement {
    return this._rootElement;
  }

  get shadowDepth(): number {
    return this._shadowPath.length;
  }

  get isDeepShadow(): boolean {
    return this.shadowDepth > 1;
  }

  get hasClosedShadow(): boolean {
    return this._shadowPath.some(path => path.mode === 'closed');
  }

  get hasOpenShadow(): boolean {
    return this._shadowPath.some(path => path.mode === 'open');
  }

  get allShadowsAccessible(): boolean {
    return this._shadowPath.every(path => path.accessible);
  }

  get outerMostHost(): DOMElement | null {
    return this._shadowPath.length > 0 ? this._shadowPath[0].host : null;
  }

  get innerMostHost(): DOMElement | null {
    return this._shadowPath.length > 0 ? 
      this._shadowPath[this._shadowPath.length - 1].host : null;
  }

  get deepestShadowRoot(): ShadowRoot | null {
    return this._traversalResult.deepestRoot;
  }

  // Methods
  getHostChain(): DOMElement[] {
    return this._shadowPath.map(path => path.host);
  }

  getShadowRoots(): ShadowRoot[] {
    return this._shadowPath.map(path => path.root);
  }

  getShadowRootInfo(): ShadowRootInfo[] {
    return this._shadowPath.map(path => ({
      mode: path.mode,
      host: path.host.element,
      delegatesFocus: path.root.delegatesFocus,
      slotAssignment: (path.root as any).slotAssignment || undefined,
      clonable: (path.root as any).clonable !== false
    }));
  }

  isElementInSameShadowContext(element: HTMLElement): boolean {
    const otherContext = ShadowContext.create(element);
    
    if (this.shadowDepth !== otherContext.shadowDepth) {
      return false;
    }
    
    if (!this._isInShadowDOM && !otherContext.isInShadowDOM) {
      return true;
    }
    
    return this._shadowPath.every((path, index) => 
      path.root === otherContext._shadowPath[index]?.root
    );
  }

  getRelativePathTo(element: HTMLElement): string[] {
    const path: string[] = [];
    
    if (!this._isInShadowDOM) {
      return this.getRegularDOMPath(this._targetElement.element, element);
    }
    
    // Build path through shadow boundaries
    this._shadowPath.forEach((shadowPath, index) => {
      if (index === 0) {
        // Path from document to outermost shadow host
        path.push(...this.getRegularDOMPath(this._rootElement, shadowPath.host.element));
      }
      
      // Indicate shadow boundary crossing
      path.push(`::shadow-root(${shadowPath.mode})`);
      
      if (index < this._shadowPath.length - 1) {
        // Path from current shadow root to next host
        const nextHost = this._shadowPath[index + 1].host.element;
        path.push(...this.getElementPathInShadow(shadowPath.root, nextHost));
      } else {
        // Path from final shadow root to target
        path.push(...this.getElementPathInShadow(shadowPath.root, this._targetElement.element));
      }
    });
    
    return path;
  }

  getCompatibilityInfo(): {
    supportsShadowDOM: boolean;
    supportsPendoTagging: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Check for closed shadow DOM
    if (this.hasClosedShadow) {
      warnings.push('Contains closed shadow DOM - limited selector access');
      recommendations.push('Use host element selectors when possible');
    }
    
    // Check for deep nesting
    if (this.isDeepShadow) {
      warnings.push(`Deep shadow DOM nesting (${this.shadowDepth} levels)`);
      recommendations.push('Consider flattening shadow DOM structure for stability');
    }
    
    // Check for unstable hosts
    const unstableHosts = this.getHostChain().filter(host => 
      Object.keys(host.getStableAttributes()).length === 0
    );
    
    if (unstableHosts.length > 0) {
      warnings.push('Some shadow hosts lack stable identifiers');
      recommendations.push('Add data-testid or stable IDs to shadow hosts');
    }
    
    return {
      supportsShadowDOM: true,
      supportsPendoTagging: this.allShadowsAccessible && !this.hasClosedShadow,
      warnings,
      recommendations
    };
  }

  // Static methods
  static traverseShadowDOM(element: HTMLElement): ShadowTraversalResult {
    const path: ShadowPath[] = [];
    let current = element;
    let depth = 0;
    
    // Traverse up through shadow boundaries
    while (current) {
      const shadowRoot = this.getContainingShadowRoot(current);
      
      if (!shadowRoot) {
        break;
      }
      
      const host = shadowRoot.host as HTMLElement;
      const mode = this.getShadowRootMode(shadowRoot);
      
      path.unshift({
        root: shadowRoot,
        host: new DOMElement(host),
        depth: depth++,
        mode,
        accessible: mode === 'open'
      });
      
      current = host;
    }
    
    return {
      found: path.length > 0,
      path,
      finalHost: path.length > 0 ? path[0].host : null,
      deepestRoot: path.length > 0 ? path[path.length - 1].root : null,
      totalDepth: path.length
    };
  }

  static getContainingShadowRoot(element: HTMLElement): ShadowRoot | null {
    let current = element;
    
    while (current) {
      if (current.parentNode && 
          current.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
          (current.parentNode as ShadowRoot).host) {
        return current.parentNode as ShadowRoot;
      }
      current = current.parentElement!;
    }
    
    return null;
  }

  static getShadowRootMode(shadowRoot: ShadowRoot): 'open' | 'closed' {
    try {
      // Try to access shadowRoot properties to determine mode
      const host = shadowRoot.host;
      if ((host as any).shadowRoot === shadowRoot) {
        return 'open';
      }
      return 'closed';
    } catch {
      return 'closed';
    }
  }

  // Private methods
  private buildShadowPath(shadowRoots: ShadowRoot[]): ShadowPath[] {
    return shadowRoots.map((root, index) => {
      const host = root.host as HTMLElement;
      const mode = ShadowContext.getShadowRootMode(root);
      
      return {
        root,
        host: new DOMElement(host),
        depth: index,
        mode,
        accessible: mode === 'open'
      };
    });
  }

  private analyzeTraversal(): ShadowTraversalResult {
    return ShadowContext.traverseShadowDOM(this._targetElement.element);
  }

  private getRegularDOMPath(from: HTMLElement, to: HTMLElement): string[] {
    const path: string[] = [];
    let current = to;
    
    while (current && current !== from && current !== document.documentElement) {
      const tagName = current.tagName.toLowerCase();
      let selector = tagName;
      
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
      }
      
      path.unshift(selector);
      current = current.parentElement!;
    }
    
    return path;
  }

  private getElementPathInShadow(shadowRoot: ShadowRoot, target: HTMLElement): string[] {
    const path: string[] = [];
    let current = target;
    
    while (current && current.parentNode !== shadowRoot) {
      const tagName = current.tagName.toLowerCase();
      let selector = tagName;
      
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
      }
      
      path.unshift(selector);
      current = current.parentElement!;
    }
    
    return path;
  }

  // Utility methods
  toString(): string {
    if (!this._isInShadowDOM) {
      return `ShadowContext(regular DOM: ${this._targetElement.toString()})`;
    }
    
    const hostChain = this.getHostChain().map(host => host.toString()).join(' → ');
    return `ShadowContext(shadow depth: ${this.shadowDepth}, hosts: ${hostChain})`;
  }

  toJSON(): object {
    return {
      isInShadowDOM: this._isInShadowDOM,
      shadowDepth: this.shadowDepth,
      hasClosedShadow: this.hasClosedShadow,
      targetElement: this._targetElement.toString(),
      hostChain: this.getHostChain().map(host => host.toString()),
      compatibility: this.getCompatibilityInfo()
    };
  }
}