// Shadow DOM Workflow - End-to-end shadow DOM detection and selector generation
// Orchestrates shadow detection, element analysis, and selector creation

import { ShadowDetector } from '../lib/shadow-dom-detector/ShadowDetector';
import { SelectorGenerator } from '../lib/shadow-dom-detector/SelectorGenerator';
import { ShadowContext } from '../lib/shadow-dom-detector/models/ShadowContext';

export interface ShadowWorkflowResult {
  success: boolean;
  element: HTMLElement;
  shadowContext: ShadowContext | null;
  selector: string;
  isInShadowDOM: boolean;
  shadowDepth: number;
  hasClosedShadow: boolean;
  recommendations: string[];
  warnings: string[];
  error?: string;
}

export interface SelectorOptions {
  includeId: boolean;
  includeClass: boolean;
  includeAttributes: boolean;
  maxDepth: number;
}

export class ShadowDOMWorkflow {
  private detector: ShadowDetector;
  private generator: SelectorGenerator;
  
  constructor() {
    this.detector = new ShadowDetector();
    this.generator = new SelectorGenerator();
  }
  
  /**
   * Analyze element with full shadow DOM workflow
   */
  async analyzeElementWithShadow(
    element: HTMLElement,
    selectorOptions?: Partial<SelectorOptions>
  ): Promise<ShadowWorkflowResult> {
    return this.analyzeElement(element, selectorOptions);
  }
  
  /**
   * Analyze element (alias for analyzeElementWithShadow)
   */
  async analyzeElement(
    element: HTMLElement,
    selectorOptions?: Partial<SelectorOptions>
  ): Promise<ShadowWorkflowResult> {
    try {
      // Step 1: Validate element
      if (!element || !(element instanceof HTMLElement)) {
        return {
          success: false,
          element,
          shadowContext: null,
          selector: '',
          isInShadowDOM: false,
          shadowDepth: 0,
          hasClosedShadow: false,
          recommendations: [],
          warnings: ['Invalid element provided'],
          error: 'Element must be a valid HTMLElement'
        };
      }
      
      // Step 2: Detect shadow context
      const shadowContext = await this.detector.detectShadowContext(element);
      
      if (!shadowContext) {
        return {
          success: false,
          element,
          shadowContext: null,
          selector: '',
          isInShadowDOM: false,
          shadowDepth: 0,
          hasClosedShadow: false,
          recommendations: [],
          warnings: ['Shadow context detection failed'],
          error: 'Could not detect shadow DOM context'
        };
      }
      
      // Step 3: Generate selector
      const selectorResult = await this.generator.generateSelector(shadowContext, {});
      const selector = selectorResult ? selectorResult.value : '';
      
      // Step 4: Extract shadow information
      const isInShadowDOM = shadowContext.isInShadowDOM;
      const shadowDepth = shadowContext.shadowDepth;
      const hasClosedShadow = shadowContext.hasClosedShadow;
      
      // Step 5: Generate recommendations
      const recommendations = this.generateRecommendations(shadowContext);
      const warnings = this.generateWarnings(shadowContext);
      
      return {
        success: true,
        element,
        shadowContext,
        selector,
        isInShadowDOM,
        shadowDepth,
        hasClosedShadow,
        recommendations,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        element,
        shadowContext: null,
        selector: '',
        isInShadowDOM: false,
        shadowDepth: 0,
        hasClosedShadow: false,
        recommendations: [],
        warnings: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Generate recommendations based on shadow context
   */
  private generateRecommendations(context: ShadowContext): string[] {
    const recommendations: string[] = [];
    
    // Closed shadow recommendations
    if (context.hasClosedShadow) {
      recommendations.push('Use host element selectors for closed shadow DOM');
      recommendations.push('Consider requesting shadow DOM to be opened if possible');
    }
    
    // Deep shadow recommendations
    if (context.shadowDepth > 2) {
      recommendations.push('Deep shadow nesting detected - selector may be complex');
      recommendations.push('Test selector thoroughly across different shadow hosts');
    }
    
    // Open shadow recommendations
    if (context.hasOpenShadow && !context.hasClosedShadow) {
      recommendations.push('Shadow DOM is fully accessible - use shadow-piercing selectors');
    }
    
    // Single shadow recommendations
    if (context.shadowDepth === 1) {
      recommendations.push('Single shadow boundary - selector should be straightforward');
    }
    
    return recommendations;
  }
  
  /**
   * Generate warnings based on shadow context
   */
  private generateWarnings(context: ShadowContext): string[] {
    const warnings: string[] = [];
    
    // Closed shadow warnings
    if (context.hasClosedShadow) {
      warnings.push('Closed shadow DOM detected - internal elements not directly accessible');
      warnings.push('Selector may only work for shadow host element');
    }
    
    // Deep nesting warnings
    if (context.shadowDepth > 3) {
      warnings.push('Very deep shadow nesting - may impact performance');
    }
    
    // Mixed shadow warnings
    if (context.hasOpenShadow && context.hasClosedShadow) {
      warnings.push('Mixed open and closed shadow DOMs detected');
      warnings.push('Selector behavior may be unpredictable');
    }
    
    return warnings;
  }
  
  /**
   * Batch analyze multiple elements
   */
  async analyzeMultipleElements(
    elements: HTMLElement[],
    selectorOptions?: Partial<SelectorOptions>
  ): Promise<ShadowWorkflowResult[]> {
    const results: ShadowWorkflowResult[] = [];
    
    for (const element of elements) {
      const result = await this.analyzeElementWithShadow(element, selectorOptions);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Find all elements in shadow DOMs on page
   */
  async findShadowElements(rootElement: HTMLElement = document.body): Promise<HTMLElement[]> {
    const shadowElements: HTMLElement[] = [];
    
    const traverse = (element: HTMLElement) => {
      // Check if element has shadow root
      if (element.shadowRoot) {
        // Get all elements in shadow root
        const shadowChildren = element.shadowRoot.querySelectorAll('*');
        shadowChildren.forEach(child => {
          if (child instanceof HTMLElement) {
            shadowElements.push(child);
            traverse(child);
          }
        });
      }
      
      // Traverse children
      element.querySelectorAll('*').forEach(child => {
        if (child instanceof HTMLElement && child !== element) {
          traverse(child);
        }
      });
    };
    
    traverse(rootElement);
    return shadowElements;
  }
  
  /**
   * Activate element picker (mock for testing)
   */
  async activatePicker(): Promise<void> {
    // Mock implementation for testing
    return Promise.resolve();
  }
  
  /**
   * Handle element hover (mock for testing)
   */
  async handleElementHover(element: HTMLElement): Promise<ShadowWorkflowResult> {
    return this.analyzeElement(element);
  }
  
  /**
   * Handle element click (mock for testing)
   */
  async handleElementClick(element: HTMLElement): Promise<ShadowWorkflowResult> {
    return this.analyzeElement(element);
  }
}
