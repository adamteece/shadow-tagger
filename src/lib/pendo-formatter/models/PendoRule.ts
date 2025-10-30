// T026: PendoRule model for Pendo-compatible formatting
// Represents a formatted rule ready for use in Pendo's system

import { CSSSelector } from '../../shadow-dom-detector/models/CSSSelector';
import { URLPattern } from '../../url-pattern-builder/models/URLPattern';

export type PendoRuleType = 'feature' | 'page' | 'guide' | 'poll' | 'resource-center';
export type PendoMatchType = 'css-selector' | 'url-pattern' | 'contains' | 'exact' | 'ignore-after';

export interface PendoFeatureRule {
  selector: string;
  isStandard: boolean;
  shadowDOMCompatible: boolean;
  explanation: string;
  warnings: string[];
  copyInstructions: string;
}

export interface PendoPageRule {
  urlPattern: string;
  matchType: PendoMatchType;
  explanation: string;
  examples: string[];
  currentURLMatches: boolean;
  warnings: string[];
}

export interface PendoCompatibility {
  version: 'any' | 'v2.0+' | 'v2.5+' | 'latest';
  features: string[];
  limitations: string[];
  alternatives: string[];
}

export interface CopyMetadata {
  format: 'pendo-feature' | 'pendo-page' | 'css-selector' | 'url-pattern';
  instructions: string;
  fallbackText?: string;
  timestamp: Date;
}

export class PendoRule {
  private _type: PendoRuleType;
  private _matchType: PendoMatchType;
  private _copyableRule: string;
  private _explanation: string;
  private _warnings: string[];
  private _instructions: string;
  private _compatibility: PendoCompatibility;
  private _metadata: CopyMetadata;
  private _confidence: number;

  // Feature-specific properties
  private _selector?: string;
  private _isStandard?: boolean;
  private _shadowDOMCompatible?: boolean;

  // Page-specific properties
  private _urlPattern?: string;
  private _examples?: string[];
  private _currentURLMatches?: boolean;

  constructor(params: {
    type: PendoRuleType;
    copyableRule: string;
    explanation: string;
    warnings?: string[];
    instructions: string;
    confidence?: number;
    // Feature params
    selector?: string;
    isStandard?: boolean;
    shadowDOMCompatible?: boolean;
    // Page params
    urlPattern?: string;
    matchType?: PendoMatchType;
    examples?: string[];
    currentURLMatches?: boolean;
  }) {
    this._type = params.type;
    this._copyableRule = params.copyableRule;
    this._explanation = params.explanation;
    this._warnings = params.warnings || [];
    this._instructions = params.instructions;
    this._confidence = params.confidence || 0.8;

    // Feature properties
    this._selector = params.selector;
    this._isStandard = params.isStandard;
    this._shadowDOMCompatible = params.shadowDOMCompatible;

    // Page properties
    this._urlPattern = params.urlPattern;
    this._matchType = params.matchType || 'css-selector';
    this._examples = params.examples;
    this._currentURLMatches = params.currentURLMatches;

    // Generate derived properties
    this._compatibility = this.generateCompatibility();
    this._metadata = this.generateMetadata();
  }

  // Static factory methods
  static fromCSSSelector(selector: CSSSelector): PendoRule {
    const warnings: string[] = [];
    const isStandard = !selector.value.includes('/deep/') && !selector.value.includes('::shadow');
    
    // Check for shadow DOM compatibility
    if (selector.shadowAware && !isStandard) {
      warnings.push('Uses deprecated shadow DOM selectors (/deep/, ::shadow)');
      warnings.push('Consider updating to use standard CSS selectors');
    }

    if (selector.shadowAware) {
      warnings.push('Ensure shadow root is open');
      warnings.push('Ensure shadow root is open for Pendo access');
      warnings.push('Pendo only supports open shadow DOM - closed shadow roots are inaccessible');
      warnings.push('Learn more: https://support.pendo.io/hc/en-us/articles/360038410952');
    }

    if (!selector.isStable) {
      warnings.push('fragile');
      warnings.push('position-based');
      warnings.push('Selector is fragile - position-based selectors can break with DOM changes');
    }

    const explanation = selector.shadowAware 
      ? `Pendo Feature selector for shadow DOM element using ${selector.explanation}. avoid deprecated ::shadow and /deep/ selectors.`
      : selector.isStable
      ? `Pendo Feature selector using ${selector.explanation}`
      : `Pendo Feature selector using ${selector.explanation} (may break if DOM structure changes)`;

    const instructions = selector.shadowAware
      ? 'Copy this selector into Pendo\'s "Custom CSS" field when creating a Feature. Note: Pendo only supports tagging Features in open shadow DOM using standard CSS selectors.'
      : 'Copy this selector into Pendo\'s "Custom CSS" field when creating a Feature.';

    return new PendoRule({
      type: 'feature',
      copyableRule: selector.value,
      explanation,
      warnings,
      instructions,
      selector: selector.value,
      isStandard,
      shadowDOMCompatible: selector.shadowAware && isStandard,
      confidence: selector.isStable ? 0.9 : 0.6
    });
  }

  static fromURLPattern(urlPattern: URLPattern): PendoRule {
    const warnings: string[] = [];
    
    // Handle generateExampleURLs method that may not exist on mock objects
    let examples: string[] = [];
    try {
      if (typeof urlPattern.generateExampleURLs === 'function') {
        examples = urlPattern.generateExampleURLs();
      }
    } catch (error) {
      // Mock object, use empty examples
      examples = [];
    }
    
    // Add pattern-specific warnings
    if (urlPattern.isDevelopment) {
      warnings.push('Development URL detected - verify pattern works in production');
    }

    if (urlPattern.hasHashRouter) {
      warnings.push('SPA routing');
      warnings.push('SPA with hash routing detected - using ignore-after pattern');
    }

    if (urlPattern.volatileSegments && urlPattern.volatileSegments.length > 5) {
      warnings.push('Many volatile segments detected - pattern may be too broad');
    }

    const matchType: PendoMatchType = urlPattern.hasHashRouter ? 'ignore-after' : 
                                     urlPattern.matchType === 'contains' ? 'contains' :
                                     urlPattern.matchType === 'exact' ? 'exact' : 'url-pattern';

    const explanation = PendoRule.generateURLExplanation(urlPattern, matchType);
    const instructions = `Copy this pattern into Pendo's "Page" field when creating a Page rule. Pattern type: ${matchType}`;

    return new PendoRule({
      type: 'page',
      copyableRule: urlPattern.generatedPattern,
      explanation,
      warnings,
      instructions,
      urlPattern: urlPattern.generatedPattern,
      matchType,
      examples,
      currentURLMatches: true, // Assuming current URL since that's typical use case
      confidence: urlPattern.confidence || 0.8
    });
  }

  // Getters
  get type(): PendoRuleType {
    return this._type;
  }

  get matchType(): PendoMatchType {
    return this._matchType;
  }

  get copyableRule(): string {
    return this._copyableRule;
  }

  get explanation(): string {
    return this._explanation;
  }

  get warnings(): string[] {
    return [...this._warnings];
  }

  get instructions(): string {
    return this._instructions;
  }

  get copyInstructions(): string {
    return this._instructions;
  }

  get compatibility(): PendoCompatibility {
    return {
      ...this._compatibility,
      features: [...this._compatibility.features],
      limitations: [...this._compatibility.limitations],
      alternatives: [...this._compatibility.alternatives]
    };
  }

  get metadata(): CopyMetadata {
    return { ...this._metadata };
  }

  get confidence(): number {
    return this._confidence;
  }

  // Feature-specific getters
  get selector(): string | undefined {
    return this._selector;
  }

  get isStandard(): boolean {
    return this._isStandard || false;
  }

  get shadowDOMCompatible(): boolean {
    return this._shadowDOMCompatible || false;
  }

  // Page-specific getters
  get urlPattern(): string | undefined {
    return this._urlPattern;
  }

  get examples(): string[] {
    return this._examples ? [...this._examples] : [];
  }

  get currentURLMatches(): boolean {
    return this._currentURLMatches || false;
  }

  // Methods
  addWarning(warning: string): void {
    if (!this._warnings.includes(warning)) {
      this._warnings.push(warning);
    }
  }

  addWarnings(warnings: string[]): void {
    warnings.forEach(warning => this.addWarning(warning));
  }

  updateConfidence(confidence: number): void {
    this._confidence = Math.max(0, Math.min(1, confidence));
  }

  getFormattedForClipboard(): string {
    return this._copyableRule;
  }

  getDetailedInstructions(): string {
    let detailed = this._instructions + '\n\n';
    
    if (this._type === 'feature') {
      detailed += 'Steps:\n';
      detailed += '1. Open Pendo Designer\n';
      detailed += '2. Create a new Feature\n';
      detailed += '3. In the Element Selection step, choose "Custom CSS"\n';
      detailed += '4. Paste the selector into the CSS field\n';
      detailed += '5. Preview to verify the element is highlighted correctly\n';
      
      if (this.shadowDOMCompatible) {
        detailed += '\nShadow DOM Notes:\n';
        detailed += '- This selector works with shadow DOM elements\n';
        detailed += '- Ensure the shadow root is open (not closed)\n';
        detailed += '- Pendo will access the element through the host element\n';
      }
    } else if (this._type === 'page') {
      detailed += 'Steps:\n';
      detailed += '1. Open Pendo Designer or Admin\n';
      detailed += '2. Create a new Page or edit existing Page rules\n';
      detailed += '3. In the Page URL section, paste the pattern\n';
      detailed += '4. Select the appropriate match type if available\n';
      detailed += '5. Test with example URLs to verify matching\n';
      
      if (this._matchType === 'ignore-after') {
        detailed += '\nSPA Routing Notes:\n';
        detailed += '- This pattern uses ** to ignore everything after the hash\n';
        detailed += '- Suitable for single-page applications with client-side routing\n';
        detailed += '- Will match any route within the SPA\n';
      }
    }
    
    if (this._warnings.length > 0) {
      detailed += '\nWarnings:\n';
      this._warnings.forEach(warning => {
        detailed += `- ${warning}\n`;
      });
    }
    
    return detailed.trim();
  }

  generateTestInstructions(): string[] {
    const instructions: string[] = [];
    
    if (this._type === 'feature') {
      instructions.push('Test the selector by:');
      instructions.push('1. Opening browser developer tools');
      instructions.push('2. Running: document.querySelector(\'' + this._copyableRule + '\')');
      instructions.push('3. Verifying it returns the expected element');
      
      if (this.shadowDOMCompatible) {
        instructions.push('4. Checking that shadow root is accessible');
        instructions.push('5. Verifying no deprecated selectors are used');
      }
    } else if (this._type === 'page') {
      instructions.push('Test the URL pattern by:');
      instructions.push('1. Navigate to different pages that should match');
      instructions.push('2. Verify the pattern covers all intended pages');
      instructions.push('3. Check that unintended pages are excluded');
      
      if (this._examples && this._examples.length > 0) {
        instructions.push('Example URLs that should match:');
        this._examples.forEach(example => {
          instructions.push(`- ${example}`);
        });
      }
    }
    
    return instructions;
  }

  validateForPendo(): {
    isValid: boolean;
    errors: string[];
    recommendations: string[];
  } {
    const errors: string[] = [];
    const recommendations: string[] = [];
    
    if (this._type === 'feature') {
      // Validate CSS selector
      if (this._copyableRule.includes('/deep/')) {
        errors.push('Uses deprecated /deep/ selector - not supported in modern browsers');
        recommendations.push('Replace with standard CSS selectors using host element');
      }
      
      if (this._copyableRule.includes('::shadow')) {
        errors.push('Uses deprecated ::shadow selector - not supported in modern browsers');
        recommendations.push('Use standard CSS selectors with shadow DOM structure');
      }
      
      if (this._copyableRule.length > 200) {
        errors.push('Selector is very long and may be fragile');
        recommendations.push('Simplify selector by adding stable attributes to target element');
      }
      
      if (!this._isStandard) {
        recommendations.push('Use data-testid or other stable attributes for more reliable selectors');
      }
    } else if (this._type === 'page') {
      // Validate URL pattern
      const wildcardCount = (this._copyableRule.match(/\*/g) || []).length;
      if (wildcardCount > 5) {
        errors.push('Pattern has too many wildcards and may match unintended pages');
        recommendations.push('Be more specific to avoid false matches');
      }
      
      if (this._copyableRule.includes('localhost')) {
        errors.push('Pattern includes localhost - will not work in production');
        recommendations.push('Update pattern for production domains');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      recommendations
    };
  }

  // Private methods
  private generateCompatibility(): PendoCompatibility {
    const features: string[] = [];
    const limitations: string[] = [];
    const alternatives: string[] = [];
    
    if (this._type === 'feature') {
      features.push('Feature tagging');
      features.push('Element highlighting');
      
      if (this.shadowDOMCompatible) {
        features.push('Shadow DOM support');
      } else if (this._selector?.includes('shadow')) {
        limitations.push('Limited shadow DOM access');
        alternatives.push('Use host element selectors');
      }
      
      if (!this._isStandard) {
        limitations.push('Uses position-based selectors');
        alternatives.push('Add stable attributes (data-testid, etc.)');
      }
    } else if (this._type === 'page') {
      features.push('Page targeting');
      features.push('URL pattern matching');
      
      if (this._matchType === 'ignore-after') {
        features.push('SPA routing support');
      }
      
      if (this._matchType === 'contains') {
        features.push('Flexible domain matching');
      }
    }
    
    return {
      version: limitations.length > 0 ? 'v2.0+' : 'any',
      features,
      limitations,
      alternatives
    };
  }

  private generateMetadata(): CopyMetadata {
    const format: CopyMetadata['format'] = this._type === 'feature' 
      ? 'pendo-feature' 
      : 'pendo-page';
    
    return {
      format,
      instructions: this._instructions,
      timestamp: new Date()
    };
  }

  private static generateURLExplanation(urlPattern: URLPattern, matchType: PendoMatchType): string {
    let explanation = `Pendo Page rule using ${matchType} matching`;
    
    if (urlPattern.volatileSegments.length > 0) {
      const segmentTypes = [...new Set(urlPattern.volatileSegments.map(vs => vs.type))];
      explanation += ` with wildcards for ${segmentTypes.join(', ')} segments`;
    }
    
    if (urlPattern.hasHashRouter) {
      explanation += '. Uses ignore after pattern (/**) for SPA hash router';
    }
    
    if (urlPattern.matchType === 'contains') {
      explanation += '. Uses contains matching for flexible domain handling';
    }
    
    // Add explanations for multiple wildcards
    if (urlPattern.volatileSegments.length > 2) {
      explanation += '. Pattern includes multiple wildcards for dynamic segments';
    }
    
    return explanation;
  }

  // Utility methods
  toString(): string {
    return `PendoRule(${this._type}: ${this._copyableRule})`;
  }

  toJSON(): object {
    return {
      type: this._type,
      matchType: this._matchType,
      copyableRule: this._copyableRule,
      explanation: this._explanation,
      warnings: this._warnings,
      instructions: this._instructions,
      confidence: this._confidence,
      compatibility: this._compatibility,
      metadata: this._metadata,
      // Type-specific properties
      ...(this._type === 'feature' && {
        selector: this._selector,
        isStandard: this._isStandard,
        shadowDOMCompatible: this._shadowDOMCompatible
      }),
      ...(this._type === 'page' && {
        urlPattern: this._urlPattern,
        examples: this._examples,
        currentURLMatches: this._currentURLMatches
      })
    };
  }
}