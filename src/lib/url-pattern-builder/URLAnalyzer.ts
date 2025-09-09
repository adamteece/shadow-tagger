// T024: URL pattern analysis service
// Analyzes URLs and identifies volatile/stable segments

import { URLPattern } from './models/URLPattern';
import { VolatileSegment, type SegmentType } from './models/VolatileSegment';

export interface AnalysisOptions {
  includeDomains: boolean;
  includeQueryParams: boolean;
  includeFragments: boolean;
  maxHistorySize: number;
  confidenceThreshold: number;
}

export interface URLAnalysisResult {
  pattern: URLPattern;
  volatileSegments: VolatileSegment[];
  confidence: number;
  coverage: number;
  recommendations: string[];
  performance: {
    analysisTime: number;
    urlsAnalyzed: number;
    patternsGenerated: number;
  };
}

export interface URLHistoryEntry {
  url: string;
  timestamp: number;
  pageTitle?: string;
  userAction?: string;
}

export class URLAnalyzer {
  private static instance: URLAnalyzer;
  private urlHistory: URLHistoryEntry[];
  private patternCache: Map<string, URLPattern>;
  private defaultOptions: AnalysisOptions;

  constructor() {
    this.urlHistory = [];
    this.patternCache = new Map();
    this.defaultOptions = {
      includeDomains: true,
      includeQueryParams: true,
      includeFragments: false,
      maxHistorySize: 1000,
      confidenceThreshold: 0.8
    };
  }

  static getInstance(): URLAnalyzer {
    if (!URLAnalyzer.instance) {
      URLAnalyzer.instance = new URLAnalyzer();
    }
    return URLAnalyzer.instance;
  }

  /**
   * Main entry point for URL analysis
   * This function is called by the contract tests
   */
  async analyzeURL(
    url: string,
    options?: Partial<AnalysisOptions>
  ): Promise<URLPattern | null> {
    if (!url || !this.isValidURL(url)) {
      return null;
    }

    const opts = { ...this.defaultOptions, ...options };
    // Performance tracking would be implemented here in production
    // const startTime = performance.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(url, opts);
      if (this.patternCache.has(cacheKey)) {
        return this.patternCache.get(cacheKey)!;
      }

      // Add to history
      this.addToHistory(url);

      // Perform analysis
      const pattern = this.performAnalysis(url, opts);
      
      // Cache result
      this.patternCache.set(cacheKey, pattern);
      
      return pattern;
    } catch (error) {
      console.error('URL analysis failed:', error);
      return null;
    }
  }

  /**
   * Analyze multiple URLs to find common patterns
   */
  async analyzeMultiple(
    urls: string[],
    options?: Partial<AnalysisOptions>
  ): Promise<URLAnalysisResult> {
    const startTime = performance.now();
    const opts = { ...this.defaultOptions, ...options };
    const patterns: URLPattern[] = [];
    const allVolatileSegments: VolatileSegment[] = [];

    // Analyze each URL
    for (const url of urls) {
      const pattern = await this.analyzeURL(url, opts);
      if (pattern) {
        patterns.push(pattern);
        allVolatileSegments.push(...pattern.volatileSegments);
      }
    }

    // Find the best common pattern
    const commonPattern = this.findCommonPattern(patterns);
    const uniqueVolatileSegments = this.deduplicateVolatileSegments(allVolatileSegments);
    
    // Calculate metrics
    const confidence = this.calculatePatternConfidence(commonPattern, patterns);
    const coverage = this.calculateCoverage(commonPattern, urls);
    const recommendations = this.generateRecommendations(commonPattern, uniqueVolatileSegments);

    const analysisTime = performance.now() - startTime;

    return {
      pattern: commonPattern,
      volatileSegments: uniqueVolatileSegments,
      confidence,
      coverage,
      recommendations,
      performance: {
        analysisTime,
        urlsAnalyzed: urls.length,
        patternsGenerated: patterns.length
      }
    };
  }

  /**
   * Get analysis for current page URL
   */
  async analyzeCurrentPage(
    options?: Partial<AnalysisOptions>
  ): Promise<URLPattern | null> {
    const currentURL = window.location.href;
    return this.analyzeURL(currentURL, options);
  }

  /**
   * Analyze URL with historical context
   */
  async analyzeWithHistory(
    url: string,
    options?: Partial<AnalysisOptions>
  ): Promise<URLAnalysisResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Get related URLs from history
    const relatedUrls = this.findRelatedUrls(url);
    const allUrls = [url, ...relatedUrls];
    
    return this.analyzeMultiple(allUrls, opts);
  }

  /**
   * Get volatile segments for a specific URL pattern
   */
  getVolatileSegments(url: string): VolatileSegment[] {
    try {
      const urlObj = new URL(url);
      const segments: VolatileSegment[] = [];

      // Analyze path segments
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      pathSegments.forEach((segment, index) => {
        const volatileType = this.detectVolatileType(segment);
        if (volatileType !== 'stable') {
          const segmentContext = {
            pathname: urlObj.pathname,
            isHashFragment: false,
            hostDomain: urlObj.hostname
          };
          
          if (index > 0) {
            segmentContext.previousSegment = pathSegments[index - 1];
          }
          
          if (index < pathSegments.length - 1) {
            segmentContext.nextSegment = pathSegments[index + 1];
          }
          
          segments.push(new VolatileSegment(segment, volatileType, index, segmentContext));
        }
      });

      // Analyze query parameters
      urlObj.searchParams.forEach((value) => {
        const volatileType = this.detectVolatileType(value);
        if (volatileType !== 'stable') {
          const segmentContext = {
            pathname: urlObj.pathname,
            isHashFragment: false,
            hostDomain: urlObj.hostname
          };
          segments.push(new VolatileSegment(value, volatileType, -1, segmentContext));
        }
      });

      return segments;
    } catch (error) {
      console.error('Failed to get volatile segments:', error);
      return [];
    }
  }

  /**
   * Test if a URL matches a pattern
   */
  testPattern(pattern: URLPattern, testUrl: string): {
    matches: boolean;
    matchedSegments: string[];
    confidence: number;
  } {
    try {
      const regex = new RegExp(pattern.generatedPattern);
      const matches = regex.test(testUrl);
      
      let matchedSegments: string[] = [];
      let confidence = 0;
      
      if (matches) {
        const match = testUrl.match(regex);
        matchedSegments = match ? Array.from(match).slice(1) : [];
        confidence = this.calculateMatchConfidence(pattern, testUrl);
      }
      
      return {
        matches,
        matchedSegments,
        confidence
      };
    } catch (error) {
      return {
        matches: false,
        matchedSegments: [],
        confidence: 0
      };
    }
  }

  /**
   * Get URL analysis statistics
   */
  getAnalysisStats(): {
    historySize: number;
    cacheSize: number;
    mostCommonPatterns: Array<{ pattern: string; count: number }>;
    volatileSegmentTypes: Array<{ type: string; count: number }>;
  } {
    const allVolatileSegments = Array.from(this.patternCache.values())
      .flatMap(pattern => pattern.volatileSegments);
      
    const segmentTypeCounts = allVolatileSegments.reduce((acc, segment) => {
      acc[segment.type] = (acc[segment.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const patternCounts = Array.from(this.patternCache.values())
      .reduce((acc, pattern) => {
        const key = pattern.components.hostname;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      historySize: this.urlHistory.length,
      cacheSize: this.patternCache.size,
      mostCommonPatterns: Object.entries(patternCounts)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      volatileSegmentTypes: Object.entries(segmentTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  /**
   * Clear analysis cache and history
   */
  clearCache(): void {
    this.patternCache.clear();
    this.urlHistory = [];
  }

  // Private methods
  private performAnalysis(url: string, options: AnalysisOptions): URLPattern {
    try {
      const urlObj = new URL(url);
      const volatileSegments = this.getVolatileSegments(url);
      
      // Calculate confidence based on volatile segments
      const confidence = this.calculateURLConfidence(volatileSegments);
      
      // Generate base URL
      let baseURL = `${urlObj.protocol}//${urlObj.hostname}`;
      if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
        baseURL += `:${urlObj.port}`;
      }
      
      // Add pathname if not including it in analysis
      if (!options.includeDomains) {
        baseURL += urlObj.pathname;
      }
      
      const pattern = new URLPattern(url);
      // Note: URLPattern constructor only takes URL string
      // The analysis properties are set internally
      return pattern;
    } catch (error) {
      throw new Error(`URL analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private generateCacheKey(url: string, options: AnalysisOptions): string {
    return `${url}:${JSON.stringify(options)}`;
  }

  private addToHistory(url: string): void {
    const entry: URLHistoryEntry = {
      url,
      timestamp: Date.now()
    };
    
    if (document.title) {
      entry.pageTitle = document.title;
    }
    
    this.urlHistory.push(entry);
    
    // Maintain history size limit
    if (this.urlHistory.length > this.defaultOptions.maxHistorySize) {
      this.urlHistory.shift();
    }
  }

  private findRelatedUrls(url: string): string[] {
    try {
      const urlObj = new URL(url);
      const baseDomain = `${urlObj.protocol}//${urlObj.hostname}`;
      
      return this.urlHistory
        .filter(entry => entry.url.startsWith(baseDomain))
        .map(entry => entry.url)
        .slice(-10); // Get last 10 related URLs
    } catch {
      return [];
    }
  }

  private findCommonPattern(patterns: URLPattern[]): URLPattern {
    if (patterns.length === 0) {
      return new URLPattern('https://example.com'); // Default fallback URL
    }
    
    if (patterns.length === 1) {
      return patterns[0]!;
    }
    
    // Find the pattern with highest confidence that covers most URLs
    return patterns.reduce((best, current) => {
      if (current.confidence > best.confidence) {
        return current;
      }
      return best;
    });
  }

  private deduplicateVolatileSegments(segments: VolatileSegment[]): VolatileSegment[] {
    const seen = new Set<string>();
    return segments.filter(segment => {
      const key = `${segment.type}:${segment.position}:${segment.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private calculatePatternConfidence(pattern: URLPattern, allPatterns: URLPattern[]): number {
    if (allPatterns.length === 0) return 0;
    
    // Base confidence from the pattern itself
    let confidence = pattern.confidence;
    
    // Boost confidence if pattern is common among all patterns
    const similarPatterns = allPatterns.filter(p => 
      p.components.hostname === pattern.components.hostname && p.volatileSegments.length === pattern.volatileSegments.length
    );
    
    const similarity = similarPatterns.length / allPatterns.length;
    confidence *= (0.5 + similarity * 0.5);
    
    return Math.min(confidence, 1.0);
  }

  private calculateCoverage(pattern: URLPattern, urls: string[]): number {
    if (urls.length === 0) return 0;
    
    const matchingUrls = urls.filter(url => {
      const result = this.testPattern(pattern, url);
      return result.matches;
    });
    
    return matchingUrls.length / urls.length;
  }

  private generateRecommendations(pattern: URLPattern, volatileSegments: VolatileSegment[]): string[] {
    const recommendations: string[] = [];
    
    if (pattern.confidence < 0.7) {
      recommendations.push('Pattern confidence is low - consider analyzing more URLs');
    }
    
    const highVolatilityCount = volatileSegments.filter(s => 
      ['uuid', 'timestamp', 'hash', 'session-id'].includes(s.type)
    ).length;
    
    if (highVolatilityCount > 3) {
      recommendations.push('High number of volatile segments - pattern may be too broad');
    }
    
    const dynamicSegments = volatileSegments.filter(s => s.type === 'alphanumeric-id' || s.type === 'numeric-id');
    if (dynamicSegments.length > 2) {
      recommendations.push('Multiple dynamic IDs detected - consider using query parameters instead');
    }
    
    if (volatileSegments.length === 0) {
      recommendations.push('No volatile segments found - pattern may be too specific');
    }
    
    return recommendations;
  }

  private detectVolatileType(segment: string): SegmentType {
    // Basic type detection - will be improved with actual VolatileSegment logic
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return 'uuid';
    }
    if (/^\d+$/.test(segment)) {
      return 'numeric-id';
    }
    if (/^[a-zA-Z0-9]+$/.test(segment) && segment.length > 8) {
      return 'alphanumeric-id';
    }
    return 'unknown';
  }

  private generateSegmentPattern(segment: string, type: string): string {
    // Basic pattern generation
    switch (type) {
      case 'uuid': return '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
      case 'numeric-id': return '\\d+';
      case 'alphanumeric-id': return '[a-zA-Z0-9]+';
      default: return '[^/]+'; // Generic fallback
    }
  }

  private calculateSegmentConfidence(segment: string, type: string): number {
    // Basic confidence calculation based on type and segment characteristics
    const typeConfidence: Record<string, number> = {
      'uuid': 0.95,
      'timestamp': 0.90,
      'hash': 0.85,
      'session-id': 0.80,
      'user-id': 0.75,
      'dynamic-id': 0.70,
      'version': 0.65,
      'locale': 0.85,
      'numeric': 0.60,
      'alphanumeric': 0.50,
      'base64': 0.75,
      'slug': 0.55,
      'date': 0.80,
      'random': 0.40,
      'stable': 1.0
    };
    
    let confidence = typeConfidence[type] || 0.5;
    
    // Adjust based on segment length and characteristics
    if (segment.length > 20) {
      confidence *= 0.9; // Very long segments might be less reliable
    } else if (segment.length < 3) {
      confidence *= 0.8; // Very short segments might be ambiguous
    }
    
    return confidence;
  }

  private calculateURLConfidence(volatileSegments: VolatileSegment[]): number {
    if (volatileSegments.length === 0) {
      return 0.8; // Static URLs have decent confidence
    }
    
    // Average confidence of all volatile segments
    const avgConfidence = volatileSegments.reduce(
      (sum, segment) => sum + segment.confidence, 0
    ) / volatileSegments.length;
    
    // Adjust based on number of volatile segments
    let confidence = avgConfidence;
    if (volatileSegments.length > 5) {
      confidence *= 0.8; // Too many volatile segments reduce confidence
    } else if (volatileSegments.length === 1) {
      confidence *= 0.9; // Single volatile segment is often reliable
    }
    
    return Math.min(confidence, 1.0);
  }

  private calculateMatchConfidence(pattern: URLPattern, testUrl: string): number {
    try {
      const testVolatileSegments = this.getVolatileSegments(testUrl);
      
      // Check if volatile segments match expected types
      let matchingSegments = 0;
      const totalSegments = Math.max(pattern.volatileSegments.length, testVolatileSegments.length);
      
      pattern.volatileSegments.forEach(patternSegment => {
        const matchingTestSegment = testVolatileSegments.find(testSegment => 
          testSegment.type === patternSegment.type && 
          testSegment.position === patternSegment.position
        );
        
        if (matchingTestSegment) {
          matchingSegments++;
        }
      });
      
      const matchRatio = totalSegments > 0 ? matchingSegments / totalSegments : 1.0;
      return matchRatio * pattern.confidence;
    } catch {
      return 0.5; // Default confidence if analysis fails
    }
  }
}

// Export the main analysis function for use in tests
export async function analyzeURL(
  url: string,
  options?: Partial<AnalysisOptions>
): Promise<URLPattern | null> {
  const analyzer = URLAnalyzer.getInstance();
  return analyzer.analyzeURL(url, options);
}