// T021: CSS selector generation service
// Generates stable, Pendo-compatible CSS selectors for elements

import { DOMElement } from './models/DOMElement';
import { ShadowContext } from './models/ShadowContext';
import { CSSSelector } from './models/CSSSelector';

export interface SelectorOptions {
  preferStableAttributes: boolean;
  maxSpecificity: number;
  includeNthChild: boolean;
  shadowDOMStrategy: 'host-based' | 'full-path' | 'minimal';
  pendoCompatible: boolean;
}

export interface SelectorAnalysis {
  alternatives: CSSSelector[];
  bestSelector: CSSSelector;
  stability: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
  recommendations: string[];
}

export class SelectorGenerator {
  private static instance: SelectorGenerator;
  private defaultOptions: SelectorOptions;

  constructor() {
    this.defaultOptions = {
      preferStableAttributes: true,
      maxSpecificity: 300,
      includeNthChild: false,
      shadowDOMStrategy: 'host-based',
      pendoCompatible: true
    };
  }

  static getInstance(): SelectorGenerator {
    if (!SelectorGenerator.instance) {
      SelectorGenerator.instance = new SelectorGenerator();
    }
    return SelectorGenerator.instance;
  }

  /**
   * Main entry point for selector generation
   * This function is called by the contract tests
   */
  async generateSelector(
    context: ShadowContext | null,
    options?: Partial<SelectorOptions>
  ): Promise<CSSSelector | null> {
    if (!context) {
      return null;
    }

    const opts = { ...this.defaultOptions, ...options };

    try {
      if (context.isInShadowDOM) {
        return this.generateShadowDOMSelector(context, opts);
      } else {
        return this.generateRegularSelector(context.targetElement, opts);
      }
    } catch (error) {
      console.error('Selector generation failed:', error);
      return null;
    }
  }

  /**
   * Generate multiple selector alternatives
   */
  async generateAlternatives(
    context: ShadowContext,
    options?: Partial<SelectorOptions>
  ): Promise<SelectorAnalysis> {
    const opts = { ...this.defaultOptions, ...options };
    const alternatives: CSSSelector[] = [];

    // Generate different types of selectors
    if (context.isInShadowDOM) {
      // Shadow DOM specific alternatives
      alternatives.push(
        await this.generateShadowDOMSelector(context, { ...opts, shadowDOMStrategy: 'host-based' }) || new CSSSelector(''),
        await this.generateShadowDOMSelector(context, { ...opts, shadowDOMStrategy: 'full-path' }) || new CSSSelector(''),
        await this.generateShadowDOMSelector(context, { ...opts, shadowDOMStrategy: 'minimal' }) || new CSSSelector('')
      );
    } else {
      // Regular DOM alternatives
      alternatives.push(
        await this.generateRegularSelector(context.targetElement, { ...opts, preferStableAttributes: true }) || new CSSSelector(''),
        await this.generateRegularSelector(context.targetElement, { ...opts, includeNthChild: true }) || new CSSSelector(''),
        await this.generateRegularSelector(context.targetElement, { ...opts, maxSpecificity: 100 }) || new CSSSelector('')
      );
    }

    // Filter out invalid selectors
    const validAlternatives = alternatives.filter(selector => 
      selector.value && selector.validation.isValid
    );

    // Find best selector
    const bestSelector = this.selectBestSelector(validAlternatives);
    const stability = this.analyzeStability(validAlternatives);
    const complexity = this.analyzeComplexity(bestSelector);
    const recommendations = this.generateRecommendations(context, bestSelector);

    return {
      alternatives: validAlternatives,
      bestSelector,
      stability,
      complexity,
      recommendations
    };
  }

  /**
   * Validate if a selector properly targets the element
   */
  validateSelector(selector: string, targetElement: HTMLElement): {
    isValid: boolean;
    matches: boolean;
    uniqueness: 'unique' | 'multiple' | 'none';
    elements: HTMLElement[];
  } {
    try {
      const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      const matches = elements.includes(targetElement);
      
      let uniqueness: 'unique' | 'multiple' | 'none';
      if (elements.length === 0) {
        uniqueness = 'none';
      } else if (elements.length === 1) {
        uniqueness = 'unique';
      } else {
        uniqueness = 'multiple';
      }

      return {
        isValid: true,
        matches,
        uniqueness,
        elements
      };
    } catch (error) {
      return {
        isValid: false,
        matches: false,
        uniqueness: 'none',
        elements: []
      };
    }
  }

  /**
   * Generate selector for element picker interaction
   */
  async generateForPicker(
    element: HTMLElement,
    mode: 'preview' | 'final'
  ): Promise<CSSSelector | null> {
    const context = ShadowContext.create(element);
    const options: Partial<SelectorOptions> = {
      preferStableAttributes: mode === 'final',
      includeNthChild: mode === 'preview',
      pendoCompatible: mode === 'final'
    };

    return this.generateSelector(context, options);
  }

  // Private methods
  private async generateShadowDOMSelector(
    context: ShadowContext,
    options: SelectorOptions
  ): Promise<CSSSelector | null> {
    if (!context.isInShadowDOM) {
      return null;
    }

    let selectorValue: string;
    const warnings: string[] = [];
    const suggestions: string[] = [];

    switch (options.shadowDOMStrategy) {
      case 'host-based':
        selectorValue = this.generateHostBasedSelector(context);
        break;
      case 'full-path':
        selectorValue = this.generateFullPathSelector(context);
        break;
      case 'minimal':
        selectorValue = this.generateMinimalSelector(context);
        break;
      default:
        selectorValue = this.generateHostBasedSelector(context);
    }

    // Add shadow DOM specific warnings
    if (context.hasClosedShadow) {
      warnings.push('Contains closed shadow DOM - selector may not work in all contexts');
      suggestions.push('Use host element selector when possible');
    }

    if (context.isDeepShadow) {
      warnings.push(`Deep shadow DOM nesting (${context.shadowDepth} levels)`);
      suggestions.push('Consider flattening shadow DOM structure');
    }

    const analysis = {
      specificity: this.calculateSpecificity(selectorValue),
      isStable: this.isStableSelector(selectorValue, context.targetElement.element),
      shadowAware: true,
      explanation: this.generateShadowExplanation(context, options.shadowDOMStrategy),
      warnings,
      suggestions
    };

    return new CSSSelector(selectorValue, analysis);
  }

  private async generateRegularSelector(
    element: DOMElement,
    options: SelectorOptions
  ): Promise<CSSSelector | null> {
    const selectorParts: string[] = [];
    let currentElement = element;
    let specificity = 0;

    // Start with the target element
    const targetSelector = this.generateElementSelector(currentElement, options);
    if (targetSelector) {
      selectorParts.unshift(targetSelector);
      specificity += this.calculateSpecificity(targetSelector);
    }

    // Add parent context if needed
    if (specificity < 50 && currentElement.hierarchy.parent) {
      const parentSelector = this.generateElementSelector(currentElement.hierarchy.parent, options);
      if (parentSelector) {
        selectorParts.unshift(parentSelector);
        specificity += this.calculateSpecificity(parentSelector);
      }
    }

    const selectorValue = selectorParts.join(' ');
    
    if (!selectorValue) {
      return null;
    }

    const analysis = {
      specificity,
      isStable: this.isStableSelector(selectorValue, element.element),
      shadowAware: false,
      explanation: this.generateRegularExplanation(selectorValue, element),
      warnings: [],
      suggestions: []
    };

    return new CSSSelector(selectorValue, analysis);
  }

  private generateHostBasedSelector(context: ShadowContext): string {
    if (!context.hostElement) {
      return this.generateFallbackSelector(context.targetElement);
    }

    const hostSelector = this.generateElementSelector(context.hostElement, this.defaultOptions);
    const internalSelector = this.generateInternalSelector(context.targetElement);
    
    return `${hostSelector} ${internalSelector}`;
  }

  private generateFullPathSelector(context: ShadowContext): string {
    const parts: string[] = [];
    
    // Add path to outermost host
    if (context.outerMostHost) {
      const hostPath = this.generatePathToElement(context.outerMostHost);
      parts.push(hostPath);
    }
    
    // Add internal path
    const internalSelector = this.generateInternalSelector(context.targetElement);
    parts.push(internalSelector);
    
    return parts.join(' ');
  }

  private generateMinimalSelector(context: ShadowContext): string {
    // Try to use just the host element + immediate target
    if (context.hostElement) {
      const hostId = context.hostElement.id;
      const targetClass = context.targetElement.className;
      
      if (hostId && targetClass) {
        return `#${hostId} .${targetClass.split(' ')[0]}`;
      }
    }
    
    return this.generateFallbackSelector(context.targetElement);
  }

  private generateElementSelector(element: DOMElement, options: SelectorOptions): string {
    // Preference order for stable selectors
    if (options.preferStableAttributes) {
      // 1. ID
      if (element.id) {
        return `#${element.id}`;
      }
      
      // 2. data-testid
      const testId = element.getAttribute('data-testid');
      if (testId) {
        return `[data-testid="${testId}"]`;
      }
      
      // 3. data-component
      const component = element.getAttribute('data-component');
      if (component) {
        return `[data-component="${component}"]`;
      }
      
      // 4. aria-label
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) {
        return `[aria-label="${ariaLabel}"]`;
      }
    }
    
    // 5. Class-based (with filtering)
    if (element.className) {
      const stableClasses = this.filterStableClasses(element.className);
      if (stableClasses.length > 0) {
        return `.${stableClasses.join('.')}`;
      }
    }
    
    // 6. Tag + attribute combination
    const attributes = element.getStableAttributes();
    if (Object.keys(attributes).length > 0) {
      const attrSelector = Object.entries(attributes)
        .map(([key, value]) => `[${key}="${value}"]`)
        .join('');
      return `${element.tagName}${attrSelector}`;
    }
    
    // 7. Fallback to tag + nth-child (if allowed)
    if (options.includeNthChild) {
      const index = element.hierarchy.index + 1;
      return `${element.tagName}:nth-child(${index})`;
    }
    
    // 8. Last resort - just tag name
    return element.tagName;
  }

  private generateInternalSelector(element: DOMElement): string {
    // Generate selector for element within shadow DOM
    const parts: string[] = [];
    
    if (element.id) {
      parts.push(`#${element.id}`);
    } else if (element.className) {
      const classes = this.filterStableClasses(element.className);
      if (classes.length > 0) {
        parts.push(`.${classes.join('.')}`);
      }
    } else {
      parts.push(element.tagName);
    }
    
    return parts.join('');
  }

  private generatePathToElement(element: DOMElement): string {
    const path: string[] = [];
    let current = element;
    
    while (current && path.length < 5) { // Limit path length
      const selector = this.generateElementSelector(current, this.defaultOptions);
      if (selector) {
        path.unshift(selector);
      }
      current = current.hierarchy.parent!;
    }
    
    return path.join(' > ');
  }

  private generateFallbackSelector(element: DOMElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const firstClass = element.className.split(' ')[0];
      return `.${firstClass}`;
    }
    
    return element.tagName;
  }

  private filterStableClasses(className: string): string[] {
    return className.split(' ')
      .filter(cls => cls.length > 0)
      .filter(cls => {
        // Filter out classes that look generated or unstable
        return !/\d{3,}/.test(cls) && // No long numbers
               !/^[a-f0-9]{6,}$/i.test(cls) && // No hex hashes
               !cls.includes('_') || cls.startsWith('test-'); // Allow test classes
      })
      .slice(0, 3); // Limit to 3 classes
  }

  private calculateSpecificity(selector: string): number {
    let specificity = 0;
    
    // IDs
    specificity += (selector.match(/#[^\s\+>~\.\[:]+/g) || []).length * 100;
    
    // Classes, attributes, pseudo-classes
    specificity += (selector.match(/\.[^\s\+>~\.\[:]+/g) || []).length * 10;
    specificity += (selector.match(/\[[^\]]+\]/g) || []).length * 10;
    
    // Elements
    specificity += (selector.match(/[^\s\+>~\.\[:]+/g) || []).length * 1;
    
    return specificity;
  }

  private isStableSelector(selector: string, element: HTMLElement): boolean {
    // Check for stable patterns
    const stablePatterns = [
      /#[a-zA-Z][\w-]*/, // ID
      /\[data-testid/, // Test ID
      /\[data-component/, // Component ID
      /\[aria-label/ // ARIA label
    ];
    
    const unstablePatterns = [
      /:nth-child/, // Position-based
      /\d{3,}/, // Long numbers
      /[a-f0-9]{6,}/i // Hex hashes
    ];
    
    const hasStable = stablePatterns.some(pattern => pattern.test(selector));
    const hasUnstable = unstablePatterns.some(pattern => pattern.test(selector));
    
    return hasStable && !hasUnstable;
  }

  private generateShadowExplanation(context: ShadowContext, strategy: string): string {
    const baseExplanation = `Shadow DOM selector using ${strategy} strategy`;
    
    if (context.isDeepShadow) {
      return `${baseExplanation} with ${context.shadowDepth} levels of nesting`;
    }
    
    return baseExplanation;
  }

  private generateRegularExplanation(selector: string, element: DOMElement): string {
    if (selector.includes('#')) {
      return 'ID-based selector for unique identification';
    }
    
    if (selector.includes('[data-testid')) {
      return 'Test ID selector for stable element targeting';
    }
    
    if (selector.includes(':nth-child')) {
      return 'Position-based selector (may be fragile)';
    }
    
    return 'CSS selector based on element attributes';
  }

  private selectBestSelector(alternatives: CSSSelector[]): CSSSelector {
    if (alternatives.length === 0) {
      return new CSSSelector('');
    }
    
    // Score selectors based on multiple criteria
    const scored = alternatives.map(selector => ({
      selector,
      score: this.scoreSelector(selector)
    }));
    
    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);
    
    return scored[0]?.selector || new CSSSelector('');
  }

  private scoreSelector(selector: CSSSelector): number {
    let score = 0;
    
    // Stability is most important
    if (selector.isStable) score += 50;
    
    // Prefer moderate specificity
    const specificity = selector.specificity;
    if (specificity >= 100 && specificity <= 200) {
      score += 30;
    } else if (specificity > 200) {
      score += 10; // Too specific
    } else {
      score += 20; // Too general
    }
    
    // Shorter selectors are better
    const length = selector.value.length;
    if (length < 50) {
      score += 20;
    } else if (length < 100) {
      score += 10;
    }
    
    // Pendo compatibility
    if (selector.validation.canBeUsedInPendo) {
      score += 25;
    }
    
    return score;
  }

  private analyzeStability(selectors: CSSSelector[]): 'high' | 'medium' | 'low' {
    const stableCount = selectors.filter(s => s.isStable).length;
    const ratio = stableCount / selectors.length;
    
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  }

  private analyzeComplexity(selector: CSSSelector): 'simple' | 'moderate' | 'complex' {
    const length = selector.value.length;
    const specificity = selector.specificity;
    
    if (length < 30 && specificity < 100) return 'simple';
    if (length < 80 && specificity < 200) return 'moderate';
    return 'complex';
  }

  private generateRecommendations(context: ShadowContext, selector: CSSSelector): string[] {
    const recommendations: string[] = [];
    
    if (!selector.isStable) {
      recommendations.push('Add data-testid or stable ID to target element');
    }
    
    if (context.isInShadowDOM && context.hasClosedShadow) {
      recommendations.push('Use open shadow roots for better selector access');
    }
    
    if (selector.specificity > 250) {
      recommendations.push('Simplify selector to reduce fragility');
    }
    
    if (context.isDeepShadow) {
      recommendations.push('Consider flattening shadow DOM structure');
    }
    
    return recommendations;
  }
}

// Export the main generation function for use in tests
export async function generateSelector(
  context: ShadowContext | null,
  options?: Partial<SelectorOptions>
): Promise<CSSSelector | null> {
  const generator = SelectorGenerator.getInstance();
  return generator.generateSelector(context, options);
}