// T025: URL pattern generation service
// Generates Pendo-compatible URL patterns from analyzed URLs

import { URLPattern } from './models/URLPattern';
import { VolatileSegment } from './models/VolatileSegment';

export interface PatternOptions {
  strictMode: boolean;
  includeSubdomains: boolean;
  caseSensitive: boolean;
  maxWildcards: number;
  pendoCompatible: boolean;
}

export interface GeneratedPattern {
  pattern: string;
  description: string;
  confidence: number;
  coverage: number;
  examples: string[];
  limitations: string[];
  pendoRule?: string;
}

export interface PatternValidation {
  isValid: boolean;
  syntax: 'valid' | 'invalid' | 'warning';
  pendoCompatible: boolean;
  issues: string[];
  suggestions: string[];
}

export class PatternGenerator {
  private static instance: PatternGenerator;
  private defaultOptions: PatternOptions;

  constructor() {
    this.defaultOptions = {
      strictMode: false,
      includeSubdomains: true,
      caseSensitive: false,
      maxWildcards: 5,
      pendoCompatible: true
    };
  }

  static getInstance(): PatternGenerator {
    if (!PatternGenerator.instance) {
      PatternGenerator.instance = new PatternGenerator();
    }
    return PatternGenerator.instance;
  }

  /**
   * Main entry point for pattern generation
   * This function is called by the contract tests
   */
  async generatePattern(
    analysis: URLPattern | null,
    options?: Partial<PatternOptions>
  ): Promise<string | null> {
    if (!analysis) {
      return null;
    }

    const opts = { ...this.defaultOptions, ...options };

    try {
      const pattern = this.performGeneration(analysis, opts);
      
      if (opts.pendoCompatible) {
        return this.makePendoCompatible(pattern);
      }
      
      return pattern;
    } catch (error) {
      console.error('Pattern generation failed:', error);
      return null;
    }
  }

  /**
   * Generate comprehensive pattern analysis
   */
  async generateDetailed(
    analysis: URLPattern,
    options?: Partial<PatternOptions>
  ): Promise<GeneratedPattern> {
    const opts = { ...this.defaultOptions, ...options };
    const pattern = await this.generatePattern(analysis, opts) || '';
    
    const description = this.generateDescription(analysis, opts);
    const confidence = this.calculatePatternConfidence(analysis, pattern);
    const coverage = this.estimateCoverage(analysis, pattern);
    const examples = this.generateExamples(analysis, pattern);
    const limitations = this.identifyLimitations(analysis, pattern);
    const pendoRule = opts.pendoCompatible ? this.generatePendoRule(pattern) : undefined;

    return {
      pattern,
      description,
      confidence,
      coverage,
      examples,
      limitations,
      ...(pendoRule && { pendoRule })
    };
  }

  /**
   * Generate multiple pattern alternatives
   */
  async generateAlternatives(
    analysis: URLPattern,
    options?: Partial<PatternOptions>
  ): Promise<GeneratedPattern[]> {
    const baseOptions = { ...this.defaultOptions, ...options };
    const alternatives: GeneratedPattern[] = [];

    // Strict pattern
    const strictPattern = await this.generateDetailed(analysis, {
      ...baseOptions,
      strictMode: true,
      maxWildcards: 2
    });
    strictPattern.description = 'Strict pattern with minimal wildcards';
    alternatives.push(strictPattern);

    // Flexible pattern
    const flexiblePattern = await this.generateDetailed(analysis, {
      ...baseOptions,
      strictMode: false,
      maxWildcards: 8
    });
    flexiblePattern.description = 'Flexible pattern with more wildcards';
    alternatives.push(flexiblePattern);

    // Domain-specific pattern
    if (baseOptions.includeSubdomains) {
      const domainPattern = await this.generateDetailed(analysis, {
        ...baseOptions,
        includeSubdomains: false
      });
      domainPattern.description = 'Domain-specific pattern without subdomain matching';
      alternatives.push(domainPattern);
    }

    // Case-sensitive pattern (if not already)
    if (!baseOptions.caseSensitive) {
      const casePattern = await this.generateDetailed(analysis, {
        ...baseOptions,
        caseSensitive: true
      });
      casePattern.description = 'Case-sensitive pattern';
      alternatives.push(casePattern);
    }

    return alternatives.filter(alt => alt.pattern && alt.pattern.length > 0);
  }

  /**
   * Validate a generated pattern
   */
  validatePattern(pattern: string, options?: Partial<PatternOptions>): PatternValidation {
    const opts = { ...this.defaultOptions, ...options };
    const issues: string[] = [];
    const suggestions: string[] = [];
    let syntax: 'valid' | 'invalid' | 'warning' = 'valid';
    let pendoCompatible = true;

    // Basic syntax validation
    if (!pattern || pattern.length === 0) {
      issues.push('Pattern is empty');
      syntax = 'invalid';
    }

    // Check for valid URL structure
    if (!pattern.match(/^https?:\/\//)) {
      issues.push('Pattern must start with http:// or https://');
      syntax = 'invalid';
    }

    // Check wildcard count
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    if (wildcardCount > opts.maxWildcards) {
      issues.push(`Too many wildcards (${wildcardCount}), maximum is ${opts.maxWildcards}`);
      syntax = 'warning';
    }

    // Pendo compatibility checks
    if (opts.pendoCompatible) {
      if (pattern.includes('(?:')) {
        issues.push('Non-capturing groups are not supported in Pendo');
        pendoCompatible = false;
      }
      
      if (pattern.includes('\\')) {
        issues.push('Escaped characters may not work in Pendo');
        pendoCompatible = false;
        suggestions.push('Use simple wildcards instead of regex escapes');
      }
      
      if (wildcardCount === 0) {
        suggestions.push('Consider adding wildcards for dynamic URL segments');
      }
    }

    // Generate suggestions
    if (syntax === 'valid' && issues.length === 0) {
      if (pattern.length > 200) {
        suggestions.push('Pattern is very long - consider simplifying');
      }
      
      if (!pattern.includes('*') && !opts.strictMode) {
        suggestions.push('Consider adding wildcards for URL parameters');
      }
    }

    return {
      isValid: syntax !== 'invalid',
      syntax,
      pendoCompatible,
      issues,
      suggestions
    };
  }

  /**
   * Test pattern against example URLs
   */
  testPattern(
    pattern: string,
    testUrls: string[]
  ): {
    matches: number;
    total: number;
    coverage: number;
    examples: Array<{ url: string; matches: boolean; reason?: string }>;
  } {
    const results = testUrls.map(url => {
      try {
        const regex = this.patternToRegex(pattern);
        const matches = regex.test(url);
        return {
          url,
          matches,
          ...(matches ? {} : { reason: 'Pattern does not match URL structure' })
        };
      } catch (error) {
        return {
          url,
          matches: false,
          reason: 'Pattern compilation failed'
        };
      }
    });

    const matches = results.filter(r => r.matches).length;
    const coverage = testUrls.length > 0 ? matches / testUrls.length : 0;

    return {
      matches,
      total: testUrls.length,
      coverage,
      examples: results
    };
  }

  /**
   * Optimize pattern for better performance and accuracy
   */
  optimizePattern(
    pattern: string,
    analysis: URLPattern,
    options?: Partial<PatternOptions>
  ): {
    optimized: string;
    improvements: string[];
    performance: {
      originalComplexity: number;
      optimizedComplexity: number;
      estimatedSpeedup: number;
    };
  } {
    const opts = { ...this.defaultOptions, ...options };
    let optimized = pattern;
    const improvements: string[] = [];
    const originalComplexity = this.calculatePatternComplexity(pattern);

    // Remove redundant wildcards
    const redundantWildcards = optimized.replace(/\*+/g, '*');
    if (redundantWildcards !== optimized) {
      optimized = redundantWildcards;
      improvements.push('Removed redundant consecutive wildcards');
    }

    // Simplify overly specific patterns
    if (opts.strictMode === false) {
      const simplified = this.simplifyPattern(optimized, analysis);
      if (simplified !== optimized) {
        optimized = simplified;
        improvements.push('Simplified overly specific segments');
      }
    }

    // Optimize for Pendo if needed
    if (opts.pendoCompatible) {
      const pendoOptimized = this.optimizeForPendo(optimized);
      if (pendoOptimized !== optimized) {
        optimized = pendoOptimized;
        improvements.push('Optimized for Pendo compatibility');
      }
    }

    const optimizedComplexity = this.calculatePatternComplexity(optimized);
    const estimatedSpeedup = originalComplexity > 0 ? originalComplexity / optimizedComplexity : 1;

    return {
      optimized,
      improvements,
      performance: {
        originalComplexity,
        optimizedComplexity,
        estimatedSpeedup
      }
    };
  }

  // Private methods
  private performGeneration(analysis: URLPattern, options: PatternOptions): string {
    try {
      const urlObj = new URL(analysis.originalURL);
      const parts: string[] = [];

      // Protocol
      parts.push(urlObj.protocol);
      parts.push('//');

      // Domain
      if (options.includeSubdomains) {
        const domainParts = urlObj.hostname.split('.');
        if (domainParts.length > 2) {
          parts.push('*.');
          parts.push(domainParts.slice(-2).join('.'));
        } else {
          parts.push(urlObj.hostname);
        }
      } else {
        parts.push(urlObj.hostname);
      }

      // Port
      if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
        parts.push(':');
        parts.push(urlObj.port);
      }

      // Path
      const pathPattern = this.generatePathPattern(urlObj.pathname, analysis.volatileSegments, options);
      parts.push(pathPattern);

      // Query parameters
      if (urlObj.search) {
        const queryPattern = this.generateQueryPattern(urlObj.search, analysis.volatileSegments, options);
        parts.push(queryPattern);
      }

      // Fragment
      if (urlObj.hash) {
        parts.push('#*'); // Usually fragments are highly variable
      }

      return parts.join('');
    } catch (error) {
      throw new Error(`Pattern generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generatePathPattern(pathname: string, volatileSegments: VolatileSegment[], options: PatternOptions): string {
    const segments = pathname.split('/').filter(Boolean);
    const patternSegments: string[] = [];

    segments.forEach((segment, index) => {
      const volatileSegment = volatileSegments.find(
        vs => vs.position === index
      );

      if (volatileSegment) {
        if (options.strictMode) {
          // Use specific patterns for strict mode
          patternSegments.push(volatileSegment.pattern || '*');
        } else {
          // Use simple wildcards for flexible mode
          patternSegments.push('*');
        }
      } else {
        // Static segment
        if (options.caseSensitive) {
          patternSegments.push(segment);
        } else {
          patternSegments.push(segment.toLowerCase());
        }
      }
    });

    return '/' + patternSegments.join('/');
  }

  private generateQueryPattern(search: string, volatileSegments: VolatileSegment[], options: PatternOptions): string {
    const params = new URLSearchParams(search);
    const patternParts: string[] = [];

    let hasVolatileParams = false;
    params.forEach((value, key) => {
      const volatileSegment = volatileSegments.find(
        vs => vs.value === value
      );

      if (volatileSegment) {
        hasVolatileParams = true;
        if (options.strictMode) {
          patternParts.push(`${key}=*`);
        } else {
          patternParts.push(`${key}=*`);
        }
      } else {
        // Static parameter
        patternParts.push(`${key}=${value}`);
      }
    });

    if (hasVolatileParams && !options.strictMode) {
      // Simple wildcard for any query parameters
      return '?*';
    } else if (patternParts.length > 0) {
      return '?' + patternParts.join('&');
    } else {
      return '';
    }
  }

  private makePendoCompatible(pattern: string): string {
    // Convert regex patterns to Pendo-compatible wildcards
    let compatible = pattern;
    
    // Replace complex regex with simple wildcards
    compatible = compatible.replace(/\[\^\?\/\]\+/g, '*'); // [^?/]+ -> *
    compatible = compatible.replace(/\[\^\?\/\]\*/g, '*'); // [^?/]* -> *
    compatible = compatible.replace(/\\d\+/g, '*'); // \d+ -> *
    compatible = compatible.replace(/\\w\+/g, '*'); // \w+ -> *
    compatible = compatible.replace(/\.\+/g, '*'); // .+ -> *
    compatible = compatible.replace(/\.\*/g, '*'); // .* -> *
    
    // Remove regex anchors
    compatible = compatible.replace(/^\^/, '');
    compatible = compatible.replace(/\$$/, '');
    
    // Remove regex escapes for common characters
    compatible = compatible.replace(/\\\./g, '.');
    compatible = compatible.replace(/\\\//g, '/');
    
    return compatible;
  }

  private generateDescription(analysis: URLPattern, options: PatternOptions): string {
    const parts: string[] = [];
    
    if (analysis.volatileSegments.length > 0) {
      parts.push(`Matches URLs with ${analysis.volatileSegments.length} dynamic segment(s)`);
    } else {
      parts.push('Matches static URL pattern');
    }
    
    if (options.includeSubdomains) {
      parts.push('including subdomains');
    }
    
    if (options.strictMode) {
      parts.push('with strict matching rules');
    }
    
    return parts.join(' ');
  }

  private calculatePatternConfidence(analysis: URLPattern, pattern: string): number {
    // Base confidence from URL analysis
    let confidence = analysis.confidence;
    
    // Adjust based on pattern complexity
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    if (wildcardCount > 3) {
      confidence *= 0.8; // Too many wildcards reduce confidence
    } else if (wildcardCount === 0) {
      confidence *= 0.9; // Static patterns are quite confident but less flexible
    }
    
    // Adjust based on volatile segment confidence
    if (analysis.volatileSegments.length > 0) {
      const avgSegmentConfidence = analysis.volatileSegments.reduce(
        (sum, segment) => sum + segment.confidence, 0
      ) / analysis.volatileSegments.length;
      
      confidence = (confidence + avgSegmentConfidence) / 2;
    }
    
    return Math.min(confidence, 1.0);
  }

  private estimateCoverage(analysis: URLPattern, pattern: string): number {
    // Estimate how many similar URLs this pattern would match
    let coverage = 0.7; // Base coverage
    
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    
    // More wildcards = higher coverage but lower precision
    coverage += wildcardCount * 0.05;
    coverage = Math.min(coverage, 0.95); // Cap at 95%
    
    // Adjust based on URL complexity
    const segmentCount = analysis.originalURL.split('/').length;
    if (segmentCount > 6) {
      coverage *= 0.8; // Complex URLs have lower coverage
    }
    
    return coverage;
  }

  private generateExamples(analysis: URLPattern, pattern: string): string[] {
    const examples: string[] = [];
    const baseUrl = new URL(analysis.originalURL);
    
    // Original URL
    examples.push(analysis.originalURL);
    
    // Generate variations based on volatile segments
    analysis.volatileSegments.forEach(segment => {
      if (segment.type === 'numeric-id' && examples.length < 5) {
        const variation = analysis.originalURL.replace(segment.value, '123');
        examples.push(variation);
      } else if (segment.type === 'uuid' && examples.length < 5) {
        const variation = analysis.originalURL.replace(
          segment.value, 
          '550e8400-e29b-41d4-a716-446655440000'
        );
        examples.push(variation);
      }
    });
    
    // Add subdomain variation if applicable
    if (pattern.includes('*.')) {
      const subdomainExample = analysis.originalURL.replace(
        baseUrl.hostname,
        'app.' + baseUrl.hostname
      );
      examples.push(subdomainExample);
    }
    
    return [...new Set(examples)].slice(0, 5); // Deduplicate and limit
  }

  private identifyLimitations(analysis: URLPattern, pattern: string): string[] {
    const limitations: string[] = [];
    
    if (pattern.includes('*')) {
      limitations.push('Wildcards may match unintended URL variations');
    }
    
    if (analysis.volatileSegments.some(s => s.confidence < 0.6)) {
      limitations.push('Some dynamic segments have low confidence detection');
    }
    
    if ((pattern.match(/\*/g) || []).length > 4) {
      limitations.push('High number of wildcards may reduce matching precision');
    }
    
    if (!pattern.includes('*') && analysis.volatileSegments.length > 0) {
      limitations.push('Pattern may be too specific for dynamic URLs');
    }
    
    return limitations;
  }

  private generatePendoRule(pattern: string): string {
    // Generate a Pendo-compatible rule format
    return `{"kind":"url","operator":"matches","value":"${pattern}"}`;
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert URL pattern to regex for testing
    let regex = pattern;
    
    // Escape special regex characters
    regex = regex.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    // Convert wildcards to regex
    regex = regex.replace(/\*/g, '.*');
    
    // Add anchors
    regex = '^' + regex + '$';
    
    return new RegExp(regex, 'i');
  }

  private calculatePatternComplexity(pattern: string): number {
    let complexity = pattern.length;
    
    // Add complexity for special characters
    complexity += (pattern.match(/[.*+?^${}()|[\]\\]/g) || []).length * 2;
    
    // Add complexity for multiple wildcards
    const wildcards = (pattern.match(/\*/g) || []).length;
    complexity += wildcards * 3;
    
    return complexity;
  }

  private simplifyPattern(pattern: string, analysis: URLPattern): string {
    let simplified = pattern;
    
    // If there are many volatile segments, use broader wildcards
    if (analysis.volatileSegments.length > 3) {
      // Replace multiple consecutive specific patterns with single wildcard
      simplified = simplified.replace(/\*\/\*\/\*/g, '*');
      simplified = simplified.replace(/\*\/\*/g, '*');
    }
    
    return simplified;
  }

  private optimizeForPendo(pattern: string): string {
    let optimized = pattern;
    
    // Ensure Pendo compatibility
    optimized = this.makePendoCompatible(optimized);
    
    // Remove unnecessary complexity
    optimized = optimized.replace(/\.\*/g, '*');
    optimized = optimized.replace(/\*\+/g, '*');
    
    return optimized;
  }
}

// Export the main generation function for use in tests
export async function generatePattern(
  analysis: URLPattern | null,
  options?: Partial<PatternOptions>
): Promise<string | null> {
  const generator = PatternGenerator.getInstance();
  return generator.generatePattern(analysis, options);
}