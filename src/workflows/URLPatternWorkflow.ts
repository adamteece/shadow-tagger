// URL Pattern Workflow - End-to-end URL analysis and pattern generation
// Orchestrates URL analysis, volatile segment detection, and pattern creation

import { URLAnalyzer } from '../lib/url-pattern-builder/URLAnalyzer';
import { URLPattern } from '../lib/url-pattern-builder/models/URLPattern';
import { VolatileSegment } from '../lib/url-pattern-builder/models/VolatileSegment';

export interface URLWorkflowResult {
  success: boolean;
  originalURL: string;
  pattern: URLPattern | null;
  generatedPattern: string;
  confidence: number;
  volatileSegments: VolatileSegment[];
  recommendations: string[];
  warnings: string[];
  error?: string;
}

export class URLPatternWorkflow {
  private analyzer: URLAnalyzer;
  
  constructor() {
    this.analyzer = new URLAnalyzer();
  }
  
  /**
   * Analyze URL and generate pattern with full workflow
   */
  async analyzeAndGeneratePattern(url: string): Promise<URLWorkflowResult> {
    return this.analyzeURL(url);
  }
  
  /**
   * Analyze URL (alias for analyzeAndGeneratePattern)
   */
  async analyzeURL(url: string): Promise<URLWorkflowResult> {
    try {
      // Step 1: Validate URL
      if (!url || typeof url !== 'string') {
        return {
          success: false,
          originalURL: url,
          pattern: null,
          generatedPattern: '',
          confidence: 0,
          volatileSegments: [],
          recommendations: [],
          warnings: ['Invalid URL provided'],
          error: 'URL must be a non-empty string'
        };
      }
      
      // Step 2: Analyze URL
      const pattern = await this.analyzer.analyzeURL(url);
      
      if (!pattern) {
        return {
          success: false,
          originalURL: url,
          pattern: null,
          generatedPattern: '',
          confidence: 0,
          volatileSegments: [],
          recommendations: [],
          warnings: ['URL analysis failed'],
          error: 'Could not parse or analyze URL'
        };
      }
      
      // Step 3: Extract results
      const volatileSegments = pattern.volatileSegments;
      const generatedPattern = pattern.generatedPattern;
      const confidence = pattern.confidence;
      
      // Step 4: Generate recommendations
      const recommendations = this.generateRecommendations(pattern);
      const warnings = this.generateWarnings(pattern);
      
      return {
        success: true,
        originalURL: url,
        pattern,
        generatedPattern,
        confidence,
        volatileSegments,
        recommendations,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        originalURL: url,
        pattern: null,
        generatedPattern: '',
        confidence: 0,
        volatileSegments: [],
        recommendations: [],
        warnings: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Generate recommendations based on pattern analysis
   */
  private generateRecommendations(pattern: URLPattern): string[] {
    const recommendations: string[] = [];
    
    // Check for hash router
    if (pattern.hasHashRouter) {
      recommendations.push('Consider using hash-bang pattern matching for SPA routes');
    }
    
    // Check for high volatility
    if (pattern.volatileSegments.length > 5) {
      recommendations.push('High number of volatile segments detected - consider more specific pattern');
    }
    
    // Check for low confidence
    if (pattern.confidence < 0.5) {
      recommendations.push('Low confidence pattern - verify with multiple URL examples');
    }
    
    // Check for development environment
    if (pattern.isDevelopment) {
      recommendations.push('Development URL detected - ensure pattern works in production');
    }
    
    // Check for query parameters
    if (pattern.hasQueryParams) {
      recommendations.push('URL contains query parameters - consider if they should be part of the pattern');
    }
    
    return recommendations;
  }
  
  /**
   * Generate warnings based on pattern analysis
   */
  private generateWarnings(pattern: URLPattern): string[] {
    const warnings: string[] = [];
    
    // Check for no volatile segments
    if (pattern.volatileSegments.length === 0 && !pattern.isStatic) {
      warnings.push('No volatile segments detected - pattern may be too specific');
    }
    
    // Check for validation issues
    if (!pattern.validation.isValid) {
      warnings.push(...pattern.validation.warnings);
    }
    
    // Check for very low confidence
    if (pattern.confidence < 0.3) {
      warnings.push('Very low confidence - pattern may not match similar URLs');
    }
    
    return warnings;
  }
  
  /**
   * Batch analyze multiple URLs
   */
  async analyzeMultipleURLs(urls: string[]): Promise<URLWorkflowResult[]> {
    const results: URLWorkflowResult[] = [];
    
    for (const url of urls) {
      const result = await this.analyzeAndGeneratePattern(url);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Find common pattern across multiple URLs
   */
  async findCommonPattern(urls: string[]): Promise<string | null> {
    if (urls.length === 0) return null;
    if (urls.length === 1) {
      const result = await this.analyzeURL(urls[0]);
      return result.generatedPattern;
    }
    
    // Analyze all URLs
    const results = await this.analyzeMultipleURLs(urls);
    
    // Find common pattern elements
    const patterns = results
      .filter(r => r.success)
      .map(r => r.generatedPattern);
    
    if (patterns.length === 0) return null;
    
    // For simplicity, return the first pattern
    // In a real implementation, you'd find the common parts
    return patterns[0];
  }
  
  /**
   * Analyze current page URL (mock for testing)
   */
  async analyzeCurrentPage(): Promise<URLWorkflowResult> {
    // In a real implementation, this would use window.location.href
    // For testing, return a basic result
    return {
      success: false,
      originalURL: '',
      pattern: null,
      generatedPattern: '',
      confidence: 0,
      volatileSegments: [],
      recommendations: [],
      warnings: ['Not available in test environment'],
      error: 'Current page analysis not available in this context'
    };
  }
}
