// T020: Shadow DOM detection service
// Core service for detecting and analyzing shadow DOM contexts

import { ShadowContext } from './models/ShadowContext';

export interface DetectionOptions {
  includeClosedShadows: boolean;
  maxDepth: number;
  timeout: number;
  validateElements: boolean;
}

export interface DetectionResult {
  context: ShadowContext;
  performance: {
    detectionTime: number;
    traversalDepth: number;
    elementsAnalyzed: number;
  };
  warnings: string[];
  errors: string[];
}

export class ShadowDetector {
  private static instance: ShadowDetector;
  private detectionCache: Map<HTMLElement, ShadowContext>;
  private defaultOptions: DetectionOptions;

  constructor() {
    this.detectionCache = new Map();
    this.defaultOptions = {
      includeClosedShadows: true,
      maxDepth: 10,
      timeout: 5000,
      validateElements: true
    };
  }

  static getInstance(): ShadowDetector {
    if (!ShadowDetector.instance) {
      ShadowDetector.instance = new ShadowDetector();
    }
    return ShadowDetector.instance;
  }

  /**
   * Main entry point for shadow DOM detection
   * This function is called by the contract tests
   */
  async detectShadowContext(
    element: HTMLElement,
    options?: Partial<DetectionOptions>
  ): Promise<ShadowContext | null> {
    if (!element) {
      return null;
    }

    const opts = { ...this.defaultOptions, ...options };
    // Performance tracking would be implemented here in production
    // const startTime = performance.now();

    try {
      // Check cache first
      if (this.detectionCache.has(element)) {
        return this.detectionCache.get(element)!;
      }

      // Validate element
      if (opts.validateElements && !this.isValidElement(element)) {
        throw new Error('Invalid element: element is not connected to DOM');
      }

      // Perform detection
      const context = this.performDetection(element, opts);
      
      // Cache result
      this.detectionCache.set(element, context);
      
      return context;
    } catch (error) {
      console.error('Shadow DOM detection failed:', error);
      return null;
    }
  }

  /**
   * Detect shadow DOM context for multiple elements
   */
  async detectMultiple(
    elements: HTMLElement[],
    options?: Partial<DetectionOptions>
  ): Promise<Map<HTMLElement, ShadowContext | null>> {
    const results = new Map<HTMLElement, ShadowContext | null>();
    const opts = { ...this.defaultOptions, ...options };

    const promises = elements.map(async (element) => {
      const context = await this.detectShadowContext(element, opts);
      results.set(element, context);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get detailed detection results with performance metrics
   */
  async detectWithMetrics(
    element: HTMLElement,
    options?: Partial<DetectionOptions>
  ): Promise<DetectionResult | null> {
    const startTime = performance.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    let elementsAnalyzed = 0;
    let traversalDepth = 0;

    try {
      const context = await this.detectShadowContext(element, options);
      
      if (!context) {
        errors.push('Failed to detect shadow context');
        return null;
      }

      // Calculate metrics
      traversalDepth = context.shadowDepth;
      elementsAnalyzed = this.calculateElementsAnalyzed(context);
      
      // Add warnings based on analysis
      if (context.hasClosedShadow) {
        warnings.push('Closed shadow DOM detected - limited access available');
      }
      
      if (context.isDeepShadow) {
        warnings.push(`Deep shadow DOM nesting (${context.shadowDepth} levels) may affect performance`);
      }

      const detectionTime = performance.now() - startTime;

      return {
        context,
        performance: {
          detectionTime,
          traversalDepth,
          elementsAnalyzed
        },
        warnings,
        errors
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        context: null as any, // Will be caught by validation
        performance: {
          detectionTime: performance.now() - startTime,
          traversalDepth: 0,
          elementsAnalyzed: 0
        },
        warnings,
        errors
      };
    }
  }

  /**
   * Check if an element is within shadow DOM
   */
  isInShadowDOM(element: HTMLElement): boolean {
    return ShadowContext.getContainingShadowRoot(element) !== null;
  }

  /**
   * Get all shadow hosts in the current document
   */
  getAllShadowHosts(): HTMLElement[] {
    const hosts: HTMLElement[] = [];
    const walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Node) => {
          const element = node as HTMLElement;
          if (element.shadowRoot) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      hosts.push(node as HTMLElement);
    }

    return hosts;
  }

  /**
   * Find elements within shadow DOM by selector
   */
  findInShadowDOM(selector: string, root?: Element): HTMLElement[] {
    const results: HTMLElement[] = [];
    const searchRoot = root || document.documentElement;

    // Search in regular DOM
    const regularElements = searchRoot.querySelectorAll(selector);
    regularElements.forEach(el => results.push(el as HTMLElement));

    // Search in shadow DOMs
    const shadowHosts = this.getAllShadowHosts();
    shadowHosts.forEach(host => {
      if (host.shadowRoot) {
        const shadowElements = host.shadowRoot.querySelectorAll(selector);
        shadowElements.forEach(el => results.push(el as HTMLElement));
        
        // Recursively search nested shadow DOMs
        const nestedResults = this.findInShadowDOM(selector, host.shadowRoot as any);
        results.push(...nestedResults);
      }
    });

    return results;
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.detectionCache.size,
      hitRate: 0, // Would need to track hits/misses for real implementation
      memoryUsage: this.estimateCacheMemoryUsage()
    };
  }

  // Private methods
  private performDetection(element: HTMLElement, options: DetectionOptions): ShadowContext {
    try {
      // Use the static factory method from ShadowContext
      const context = ShadowContext.create(element);
      
      // Validate depth limits
      if (context.shadowDepth > options.maxDepth) {
        throw new Error(`Shadow DOM depth (${context.shadowDepth}) exceeds maximum allowed (${options.maxDepth})`);
      }
      
      // Filter out closed shadows if not requested
      if (!options.includeClosedShadows && context.hasClosedShadow) {
        // Create a new context with only open shadows
        const openShadowPath = context.shadowPathDetailed.filter(path => path.mode === 'open');
        const openShadowRoots = openShadowPath.map(path => path.root);
        
        return new ShadowContext({
          isInShadowDOM: openShadowRoots.length > 0,
          targetElement: context.targetElement,
          hostElement: openShadowPath.length > 0 ? (openShadowPath[0]?.host || null) : null,
          shadowPath: openShadowRoots
        });
      }
      
      return context;
    } catch (error) {
      throw new Error(`Shadow detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidElement(element: HTMLElement): boolean {
    // Element must be an HTMLElement and connected to the DOM
    // Note: Elements in shadow DOM won't be in document, but will be isConnected
    return element instanceof HTMLElement && element.isConnected;
  }

  private calculateElementsAnalyzed(context: ShadowContext): number {
    let count = 1; // Target element
    
    // Count host elements
    count += context.shadowDepth;
    
    // Estimate based on traversal (simplified)
    count += context.shadowDepth * 2; // Average elements traversed per level
    
    return count;
  }

  private estimateCacheMemoryUsage(): number {
    // Rough estimate: each cached context ~1KB
    return this.detectionCache.size * 1024;
  }
}

// Export the main detection function for use in tests
export async function detectShadowContext(
  element: HTMLElement,
  options?: Partial<DetectionOptions>
): Promise<ShadowContext | null> {
  const detector = ShadowDetector.getInstance();
  return detector.detectShadowContext(element, options);
}