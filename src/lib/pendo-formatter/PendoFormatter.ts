// T027: Pendo rule formatting service
// Formats CSS selectors and URL patterns into Pendo-compatible rules

import { CSSSelector } from '../shadow-dom-detector/models/CSSSelector';
import { URLPattern } from '../url-pattern-builder/models/URLPattern';
import { PendoRule } from './models/PendoRule';

export interface FormatOptions {
  includeCSS: boolean;
  includeURL: boolean;
  validateCompatibility: boolean;
  generateFallbacks: boolean;
  includeMetadata: boolean;
}

export interface FormattedRule {
  rule: PendoRule;
  validation: {
    isValid: boolean;
    compatibility: 'full' | 'partial' | 'none';
    warnings: string[];
    suggestions: string[];
  };
  alternatives: PendoRule[];
  instructions: string;
}

export interface BatchFormatResult {
  rules: FormattedRule[];
  summary: {
    total: number;
    valid: number;
    warnings: number;
    failed: number;
  };
  recommendations: string[];
}

export class PendoFormatter {
  private static instance: PendoFormatter;
  private defaultOptions: FormatOptions;

  constructor() {
    this.defaultOptions = {
      includeCSS: true,
      includeURL: true,
      validateCompatibility: true,
      generateFallbacks: true,
      includeMetadata: true
    };
  }

  static getInstance(): PendoFormatter {
    if (!PendoFormatter.instance) {
      PendoFormatter.instance = new PendoFormatter();
    }
    return PendoFormatter.instance;
  }

  /**
   * Main entry point for formatting Pendo rules
   * This function is called by the contract tests
   */
  async formatRule(
    selector: CSSSelector | null,
    urlPattern: URLPattern | null,
    options?: Partial<FormatOptions>
  ): Promise<PendoRule | null> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Validate inputs
      if (!selector && !urlPattern) {
        return null;
      }

      if (!opts.includeCSS) {
        selector = null;
      }

      if (!opts.includeURL) {
        urlPattern = null;
      }

      // Create rule based on available inputs
      if (selector && urlPattern) {
        return this.createCombinedRule(selector, urlPattern, opts);
      } else if (selector) {
        return this.createSelectorRule(selector, opts);
      } else if (urlPattern) {
        return this.createURLRule(urlPattern, opts);
      }

      return null;
    } catch (error) {
      console.error('Pendo rule formatting failed:', error);
      return null;
    }
  }

  /**
   * Format rule with comprehensive validation and alternatives
   */
  async formatDetailed(
    selector: CSSSelector | null,
    urlPattern: URLPattern | null,
    options?: Partial<FormatOptions>
  ): Promise<FormattedRule | null> {
    const opts = { ...this.defaultOptions, ...options };
    const rule = await this.formatRule(selector, urlPattern, opts);

    if (!rule) {
      return null;
    }

    // Validate the rule
    const validation = this.validateRule(rule);
    
    // Generate alternatives
    const alternatives = await this.generateAlternatives(selector, urlPattern, opts);
    
    // Generate instructions
    const instructions = this.generateInstructions(rule, selector, urlPattern);

    return {
      rule,
      validation,
      alternatives,
      instructions
    };
  }

  /**
   * Format multiple rules in batch
   */
  async formatBatch(
    items: Array<{
      selector?: CSSSelector;
      urlPattern?: URLPattern;
      identifier?: string;
    }>,
    options?: Partial<FormatOptions>
  ): Promise<BatchFormatResult> {
    const opts = { ...this.defaultOptions, ...options };
    const rules: FormattedRule[] = [];
    let valid = 0;
    let warnings = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const formatted = await this.formatDetailed(
          item.selector || null,
          item.urlPattern || null,
          opts
        );

        if (formatted) {
          rules.push(formatted);
          
          if (formatted.validation.isValid) {
            valid++;
          } else {
            failed++;
          }
          
          if (formatted.validation.warnings.length > 0) {
            warnings++;
          }
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to format rule for item ${item.identifier}:`, error);
        failed++;
      }
    }

    const recommendations = this.generateBatchRecommendations(rules);

    return {
      rules,
      summary: {
        total: items.length,
        valid,
        warnings,
        failed
      },
      recommendations
    };
  }

  /**
   * Create a feature rule for Pendo features
   */
  async createFeatureRule(
    selector: CSSSelector,
    urlPattern: URLPattern | null,
    featureName: string,
    options?: Partial<FormatOptions>
  ): Promise<PendoRule | null> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const baseRule = await this.formatRule(selector, urlPattern, opts);
      
      if (!baseRule) {
        return null;
      }

      // Create feature-specific rule
      return PendoRule.fromCSSSelector(
        selector,
        'feature',
        {
          name: featureName,
          description: `Feature rule for ${featureName}`,
          urlPattern: urlPattern?.regexPattern
        }
      );
    } catch (error) {
      console.error('Failed to create feature rule:', error);
      return null;
    }
  }

  /**
   * Create a page rule for Pendo pages
   */
  async createPageRule(
    urlPattern: URLPattern,
    pageName: string,
    options?: Partial<FormatOptions>
  ): Promise<PendoRule | null> {
    try {
      // Create page-specific rule
      return PendoRule.fromURLPattern(
        urlPattern,
        'page',
        {
          name: pageName,
          description: `Page rule for ${pageName}`
        }
      );
    } catch (error) {
      console.error('Failed to create page rule:', error);
      return null;
    }
  }

  /**
   * Validate a Pendo rule for compatibility
   */
  validateRule(rule: PendoRule): {
    isValid: boolean;
    compatibility: 'full' | 'partial' | 'none';
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let compatibility: 'full' | 'partial' | 'none' = 'full';

    // Check basic validity
    if (!rule.validation.isValid) {
      return {
        isValid: false,
        compatibility: 'none',
        warnings: ['Rule failed basic validation'],
        suggestions: ['Check rule format and required fields']
      };
    }

    // Check Pendo compatibility
    if (!rule.validation.canBeUsedInPendo) {
      compatibility = 'partial';
      warnings.push('Rule may have limited Pendo compatibility');
      suggestions.push('Consider simplifying selectors or URL patterns');
    }

    // Check CSS selector complexity
    if (rule.selector && rule.selector.length > 200) {
      warnings.push('CSS selector is very long and may be fragile');
      suggestions.push('Simplify selector by using stable attributes');
    }

    // Check URL pattern complexity
    if (rule.urlPattern && (rule.urlPattern.match(/\*/g) || []).length > 5) {
      warnings.push('URL pattern has many wildcards');
      suggestions.push('Consider using more specific patterns');
    }

    // Check for shadow DOM usage
    if (rule.selector && rule.selector.includes('host')) {
      compatibility = 'partial';
      warnings.push('Shadow DOM selectors may not work in all Pendo contexts');
      suggestions.push('Test thoroughly in Pendo environment');
    }

    return {
      isValid: true,
      compatibility,
      warnings,
      suggestions
    };
  }

  /**
   * Test if rule works in current context
   */
  testRule(rule: PendoRule): {
    cssMatches: boolean;
    urlMatches: boolean;
    elements: HTMLElement[];
    issues: string[];
  } {
    const issues: string[] = [];
    let cssMatches = false;
    let urlMatches = false;
    let elements: HTMLElement[] = [];

    // Test CSS selector
    if (rule.selector) {
      try {
        elements = Array.from(document.querySelectorAll(rule.selector)) as HTMLElement[];
        cssMatches = elements.length > 0;
        
        if (!cssMatches) {
          issues.push('CSS selector matches no elements');
        } else if (elements.length > 1) {
          issues.push(`CSS selector matches ${elements.length} elements (may not be unique)`);
        }
      } catch (error) {
        issues.push('CSS selector is invalid: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }

    // Test URL pattern
    if (rule.urlPattern) {
      try {
        const regex = new RegExp(rule.urlPattern.replace(/\*/g, '.*'));
        urlMatches = regex.test(window.location.href);
        
        if (!urlMatches) {
          issues.push('URL pattern does not match current page');
        }
      } catch (error) {
        issues.push('URL pattern is invalid: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } else {
      urlMatches = true; // No URL restriction
    }

    return {
      cssMatches,
      urlMatches,
      elements,
      issues
    };
  }

  // Private methods
  private createCombinedRule(
    selector: CSSSelector,
    urlPattern: URLPattern,
    options: FormatOptions
  ): PendoRule | null {
    try {
      // Create a combined rule with both CSS and URL constraints
      return PendoRule.fromCSSSelector(
        selector,
        'feature',
        {
          urlPattern: urlPattern.regexPattern,
          description: 'Combined CSS and URL rule'
        }
      );
    } catch (error) {
      console.error('Failed to create combined rule:', error);
      return null;
    }
  }

  private createSelectorRule(
    selector: CSSSelector,
    options: FormatOptions
  ): PendoRule | null {
    try {
      return PendoRule.fromCSSSelector(
        selector,
        'feature',
        {
          description: 'CSS selector rule'
        }
      );
    } catch (error) {
      console.error('Failed to create selector rule:', error);
      return null;
    }
  }

  private createURLRule(
    urlPattern: URLPattern,
    options: FormatOptions
  ): PendoRule | null {
    try {
      return PendoRule.fromURLPattern(
        urlPattern,
        'page',
        {
          description: 'URL pattern rule'
        }
      );
    } catch (error) {
      console.error('Failed to create URL rule:', error);
      return null;
    }
  }

  private async generateAlternatives(
    selector: CSSSelector | null,
    urlPattern: URLPattern | null,
    options: FormatOptions
  ): Promise<PendoRule[]> {
    const alternatives: PendoRule[] = [];

    try {
      // Generate selector-only rule if we have both
      if (selector && urlPattern) {
        const selectorOnly = await this.createSelectorRule(selector, options);
        if (selectorOnly) {
          alternatives.push(selectorOnly);
        }

        const urlOnly = await this.createURLRule(urlPattern, options);
        if (urlOnly) {
          alternatives.push(urlOnly);
        }
      }

      // Generate simplified versions
      if (selector && selector.value.length > 50) {
        // Try to create a simplified selector
        const simplifiedSelector = this.simplifySelector(selector);
        if (simplifiedSelector) {
          const simplified = await this.createSelectorRule(simplifiedSelector, options);
          if (simplified) {
            alternatives.push(simplified);
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate alternatives:', error);
    }

    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  private generateInstructions(
    rule: PendoRule,
    selector: CSSSelector | null,
    urlPattern: URLPattern | null
  ): string {
    const parts: string[] = [];

    if (rule.type === 'feature') {
      parts.push('1. In Pendo, create a new Feature');
      parts.push('2. Set the targeting rules:');
      
      if (rule.cssSelector) {
        parts.push(`   - CSS Selector: ${rule.cssSelector}`);
      }
      
      if (rule.urlPattern) {
        parts.push(`   - URL Pattern: ${rule.urlPattern}`);
      }
      
      parts.push('3. Test the feature on your site');
      parts.push('4. Publish when ready');
    } else if (rule.type === 'page') {
      parts.push('1. In Pendo, create a new Page');
      parts.push('2. Set the URL rules:');
      
      if (rule.urlPattern) {
        parts.push(`   - URL Pattern: ${rule.urlPattern}`);
      }
      
      parts.push('3. Verify page detection');
      parts.push('4. Save the page definition');
    }

    return parts.join('\n');
  }

  private generateBatchRecommendations(rules: FormattedRule[]): string[] {
    const recommendations: string[] = [];
    
    const failedCount = rules.filter(r => !r.validation.isValid).length;
    const warningCount = rules.filter(r => r.validation.warnings.length > 0).length;
    
    if (failedCount > 0) {
      recommendations.push(`${failedCount} rules failed validation - review and fix before using`);
    }
    
    if (warningCount > 0) {
      recommendations.push(`${warningCount} rules have warnings - test thoroughly in Pendo`);
    }
    
    const shadowDOMCount = rules.filter(r => 
      r.rule.selector && r.rule.selector.includes('host')
    ).length;
    
    if (shadowDOMCount > 0) {
      recommendations.push(`${shadowDOMCount} rules use shadow DOM - may need special handling`);
    }
    
    if (rules.length > 10) {
      recommendations.push('Large number of rules - consider grouping by feature or page');
    }
    
    return recommendations;
  }

  private simplifySelector(selector: CSSSelector): CSSSelector | null {
    try {
      // Try to extract the most important part of the selector
      let simplified = selector.value;
      
      // Remove overly specific parts
      simplified = simplified.replace(/:nth-child\([^)]+\)/g, '');
      simplified = simplified.replace(/:nth-of-type\([^)]+\)/g, '');
      simplified = simplified.replace(/\s*>\s*/g, ' '); // Remove direct child selectors
      
      // Clean up whitespace
      simplified = simplified.replace(/\s+/g, ' ').trim();
      
      if (simplified && simplified !== selector.value && simplified.length > 0) {
        return new CSSSelector(simplified);
      }
    } catch (error) {
      console.error('Failed to simplify selector:', error);
    }
    
    return null;
  }
}

// Export the main formatting function for use in tests
export async function formatRule(
  selector: CSSSelector | null,
  urlPattern: URLPattern | null,
  options?: Partial<FormatOptions>
): Promise<PendoRule | null> {
  const formatter = PendoFormatter.getInstance();
  return formatter.formatRule(selector, urlPattern, options);
}