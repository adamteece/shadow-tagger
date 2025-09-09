// CSSSelector model for shadow DOM detection
// Represents a CSS selector with its properties and analysis

export interface SelectorAnalysis {
  specificity: number;
  isStable: boolean;
  shadowAware: boolean;
  explanation: string;
  warnings: string[];
  suggestions: string[];
}

export interface SelectorValidation {
  isValid: boolean;
  errors: string[];
  canBeUsedInPendo: boolean;
  compatibility: 'full' | 'partial' | 'none';
}

export class CSSSelector {
  private _value: string;
  private _analysis: SelectorAnalysis;
  private _validation: SelectorValidation;

  constructor(value: string, analysis: Partial<SelectorAnalysis> = {}) {
    this._value = value;
    this._analysis = {
      specificity: analysis.specificity || this.calculateSpecificity(),
      isStable: analysis.isStable !== undefined ? analysis.isStable : this.analyzeStability(),
      shadowAware: analysis.shadowAware || false,
      explanation: analysis.explanation || this.generateExplanation(),
      warnings: analysis.warnings || [],
      suggestions: analysis.suggestions || []
    };
    this._validation = this.validateSelector();
  }

  // Getters
  get value(): string {
    return this._value;
  }

  get specificity(): number {
    return this._analysis.specificity;
  }

  get isStable(): boolean {
    return this._analysis.isStable;
  }

  get shadowAware(): boolean {
    return this._analysis.shadowAware;
  }

  get explanation(): string {
    return this._analysis.explanation;
  }

  get warnings(): string[] {
    return [...this._analysis.warnings];
  }

  get suggestions(): string[] {
    return [...this._analysis.suggestions];
  }

  get validation(): SelectorValidation {
    return {
      ...this._validation,
      errors: [...this._validation.errors]
    };
  }

  // Methods
  private calculateSpecificity(): number {
    let specificity = 0;
    
    // Count IDs (100 points each)
    specificity += (this._value.match(/#[^\s\+>~\.\[:]+/g) || []).length * 100;
    
    // Count classes, attributes, pseudo-classes (10 points each)
    specificity += (this._value.match(/\.[^\s\+>~\.\[:]+/g) || []).length * 10;
    specificity += (this._value.match(/\[[^\]]+\]/g) || []).length * 10;
    specificity += (this._value.match(/:(?!:)[^\s\+>~\.\[:]+/g) || []).length * 10;
    
    // Count elements and pseudo-elements (1 point each)
    specificity += (this._value.match(/[^\s\+>~\.\[:]+/g) || []).length * 1;
    
    return specificity;
  }

  private analyzeStability(): boolean {
    // Stable selectors typically have:
    // - IDs
    // - data-testid attributes
    // - data-component attributes
    // - aria-label attributes
    
    const stablePatterns = [
      /#[a-zA-Z][\w-]*/, // ID selectors
      /\[data-testid/, // data-testid attributes
      /\[data-component/, // data-component attributes
      /\[aria-label/, // aria-label attributes
      /\[role=/, // role attributes
    ];
    
    const unstablePatterns = [
      /:nth-child/, // position-based
      /:nth-of-type/, // position-based
      /\.[a-zA-Z]*\d+/, // classes with numbers
      /\d{3,}/, // long numbers (likely generated)
    ];
    
    const hasStablePattern = stablePatterns.some(pattern => pattern.test(this._value));
    const hasUnstablePattern = unstablePatterns.some(pattern => pattern.test(this._value));
    
    return hasStablePattern && !hasUnstablePattern;
  }

  private generateExplanation(): string {
    if (this._value.includes('#')) {
      return 'ID-based selector for unique element identification';
    }
    
    if (this._value.includes('[data-testid')) {
      return 'Test ID attribute selector for stable element targeting';
    }
    
    if (this._value.includes('[aria-label')) {
      return 'ARIA label selector for accessible element identification';
    }
    
    if (this._value.includes(':nth-child') || this._value.includes(':nth-of-type')) {
      return 'Position-based selector (may be fragile if DOM structure changes)';
    }
    
    if (this._value.includes('.')) {
      return 'Class-based selector for element styling identification';
    }
    
    return 'Element selector based on tag name and attributes';
  }

  private validateSelector(): SelectorValidation {
    const errors: string[] = [];
    let compatibility: 'full' | 'partial' | 'none' = 'full';
    
    try {
      // Test if selector is valid CSS
      document.querySelector(this._value);
    } catch (e) {
      errors.push('Invalid CSS selector syntax');
      compatibility = 'none';
    }
    
    // Check for deprecated shadow DOM selectors
    if (this._value.includes('/deep/') || this._value.includes('::shadow')) {
      errors.push('Uses deprecated shadow DOM selectors');
      compatibility = 'none';
    }
    
    // Check for overly complex selectors
    if (this._value.length > 200) {
      errors.push('Selector is very long and may be fragile');
      compatibility = 'partial';
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      canBeUsedInPendo: compatibility !== 'none',
      compatibility
    };
  }

  toString(): string {
    return this._value;
  }

  toJSON(): object {
    return {
      value: this._value,
      specificity: this._analysis.specificity,
      isStable: this._analysis.isStable,
      shadowAware: this._analysis.shadowAware,
      explanation: this._analysis.explanation,
      warnings: this._analysis.warnings,
      validation: this._validation
    };
  }
}