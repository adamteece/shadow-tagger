// T022: URLPattern model for URL analysis and pattern generation
// Represents a URL with identified volatile segments and generated patterns

import { VolatileSegment } from './VolatileSegment';

export type PatternMatchType = 'exact' | 'wildcard' | 'contains' | 'regex';
export type URLType = 'static' | 'dynamic' | 'spa' | 'api' | 'asset';
export type EnvironmentType = 'production' | 'staging' | 'development' | 'local';

export interface URLComponents {
  protocol: string;
  hostname: string;
  port?: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
}

export interface QueryParams {
  [key: string]: string;
}

export interface PatternGenerationOptions {
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  preserveQuery: boolean;
  preserveHash: boolean;
  maxWildcards: number;
  minConfidence: number;
}

export interface PatternValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class URLPattern {
  private _originalURL: string;
  private _components: URLComponents;
  private _volatileSegments: VolatileSegment[];
  private _generatedPattern: string;
  private _matchType: PatternMatchType;
  private _confidence: number;
  private _urlType: URLType;
  private _environment: EnvironmentType;
  private _queryParams: QueryParams;
  private _validation: PatternValidation;

  constructor(url: string, options?: Partial<PatternGenerationOptions>) {
    this._originalURL = url;
    this._components = this.parseURL(url);
    this._queryParams = this.parseQueryParams();
    this._environment = this.detectEnvironment();
    this._urlType = this.detectURLType();
    this._volatileSegments = this.identifyVolatileSegments();
    this._generatedPattern = this.generatePattern(options);
    this._matchType = this.determineMatchType();
    this._confidence = this.calculateConfidence();
    this._validation = this.validatePattern();
  }

  // Getters
  get originalURL(): string {
    return this._originalURL;
  }

  get components(): URLComponents {
    return { ...this._components };
  }

  get volatileSegments(): VolatileSegment[] {
    return [...this._volatileSegments];
  }

  get generatedPattern(): string {
    return this._generatedPattern;
  }

  get matchType(): PatternMatchType {
    return this._matchType;
  }

  get confidence(): number {
    return this._confidence;
  }

  get urlType(): URLType {
    return this._urlType;
  }

  get environment(): EnvironmentType {
    return this._environment;
  }

  get queryParams(): QueryParams {
    return { ...this._queryParams };
  }

  get validation(): PatternValidation {
    return {
      ...this._validation,
      errors: [...this._validation.errors],
      warnings: [...this._validation.warnings],
      suggestions: [...this._validation.suggestions]
    };
  }

  get pathname(): string {
    return this._components.pathname;
  }

  get hostname(): string {
    return this._components.hostname;
  }

  get hasQueryParams(): boolean {
    return Object.keys(this._queryParams).length > 0;
  }

  get hasHashFragment(): boolean {
    return this._components.hash.length > 0;
  }

  get hasHashRouter(): boolean {
    return this._components.hash.startsWith('#/') || this._components.hash.startsWith('#!/');
  }

  get hasHashBangRouter(): boolean {
    return this._components.hash.startsWith('#!/');
  }

  get fragment(): string {
    return this._components.hash.replace(/^#!?\//, '');
  }

  get hashFragment(): string {
    return this.fragment;
  }

  get isStatic(): boolean {
    return this._volatileSegments.length === 0 && this._urlType === 'static';
  }

  get isDynamic(): boolean {
    return this._volatileSegments.length > 0;
  }

  get isDevelopment(): boolean {
    return this._environment === 'development' || this._environment === 'local';
  }

  get isAPI(): boolean {
    return this._urlType === 'api';
  }

  get isSPA(): boolean {
    return this._urlType === 'spa' || this.hasHashRouter;
  }

  // Methods
  getSegments(): string[] {
    return this._components.pathname.split('/').filter(segment => segment.length > 0);
  }

  getVolatileSegmentsByType(type: string): VolatileSegment[] {
    return this._volatileSegments.filter(segment => segment.type === type);
  }

  getStaticSegments(): string[] {
    const segments = this.getSegments();
    const volatilePositions = this._volatileSegments.map(vs => vs.position);
    
    return segments.filter((_, index) => !volatilePositions.includes(index));
  }

  hasVolatileSegmentOfType(type: string): boolean {
    return this._volatileSegments.some(segment => segment.type === type);
  }

  getPatternForType(type: PatternMatchType): string {
    switch (type) {
      case 'exact':
        return this._originalURL;
      case 'contains':
        return `*${this._components.hostname}*`;
      case 'wildcard':
        return this._generatedPattern;
      case 'regex':
        return this.generateRegexPattern();
      default:
        return this._generatedPattern;
    }
  }

  generateExampleURLs(count: number = 3): string[] {
    const examples: string[] = [];
    const segments = this.getSegments();
    
    for (let i = 0; i < count; i++) {
      const exampleSegments = segments.map((segment, index) => {
        const volatileSegment = this._volatileSegments.find(vs => vs.position === index);
        
        if (volatileSegment) {
          return this.generateExampleValue(volatileSegment.type, i);
        }
        return segment;
      });
      
      const examplePath = '/' + exampleSegments.join('/');
      const exampleURL = `${this._components.protocol}//${this._components.hostname}${examplePath}`;
      
      if (this.hasHashRouter) {
        const hashPath = this.generateExampleHashPath(i);
        examples.push(`${exampleURL}#/${hashPath}`);
      } else {
        examples.push(exampleURL);
      }
    }
    
    return examples;
  }

  matchesURL(testURL: string): boolean {
    try {
      const testPattern = new URLPattern(testURL);
      
      if (this._matchType === 'exact') {
        return testURL === this._originalURL;
      }
      
      if (this._matchType === 'contains') {
        return testURL.includes(this._components.hostname);
      }
      
      if (this._matchType === 'wildcard') {
        return this.matchesWildcardPattern(testURL);
      }
      
      return false;
    } catch {
      return false;
    }
  }

  getFlexibilityScore(): number {
    let score = 0;
    
    // More wildcards = more flexible
    score += this._volatileSegments.length * 0.2;
    
    // Contains pattern is most flexible
    if (this._matchType === 'contains') score += 0.4;
    
    // Hash router patterns are flexible
    if (this.hasHashRouter) score += 0.3;
    
    // Multiple segment types = more flexible
    const uniqueTypes = new Set(this._volatileSegments.map(vs => vs.type));
    score += uniqueTypes.size * 0.1;
    
    return Math.min(score, 1.0);
  }

  // Private methods
  private parseURL(url: string): URLComponents {
    try {
      const parsed = new URL(url);
      return {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        origin: parsed.origin
      };
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  private parseQueryParams(): QueryParams {
    const params: QueryParams = {};
    
    if (this._components.search) {
      const urlParams = new URLSearchParams(this._components.search);
      for (const [key, value] of urlParams) {
        params[key] = value;
      }
    }
    
    return params;
  }

  private detectEnvironment(): EnvironmentType {
    const hostname = this._components.hostname.toLowerCase();
    
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.endsWith('.local')) {
      return 'local';
    }
    
    if (hostname.includes('dev') || hostname.includes('development')) {
      return 'development';
    }
    
    if (hostname.includes('staging') || hostname.includes('stage') || hostname.includes('test')) {
      return 'staging';
    }
    
    return 'production';
  }

  private detectURLType(): URLType {
    const pathname = this._components.pathname.toLowerCase();
    const hostname = this._components.hostname.toLowerCase();
    
    // API detection
    if (pathname.startsWith('/api/') || hostname.startsWith('api.') || 
        pathname.includes('/v1/') || pathname.includes('/v2/')) {
      return 'api';
    }
    
    // Asset detection
    if (pathname.match(/\.(js|css|png|jpg|gif|svg|woff|ttf)$/)) {
      return 'asset';
    }
    
    // SPA detection
    if (this.hasHashRouter || hostname.includes('spa')) {
      return 'spa';
    }
    
    // Dynamic detection
    const segments = this.getSegments();
    const hasDynamicSegments = segments.some(segment => 
      /\d{3,}|[a-f0-9]{8,}|uuid|guid/.test(segment)
    );
    
    return hasDynamicSegments ? 'dynamic' : 'static';
  }

  private identifyVolatileSegments(): VolatileSegment[] {
    const segments = this.getSegments();
    const volatileSegments: VolatileSegment[] = [];
    
    segments.forEach((segment, index) => {
      const volatileSegment = VolatileSegment.analyze(segment, index, {
        pathname: this._components.pathname,
        isHashFragment: false
      });
      
      if (volatileSegment) {
        volatileSegments.push(volatileSegment);
      }
    });
    
    // Also check hash fragment for volatile segments
    if (this.hasHashRouter) {
      const hashSegments = this.fragment.split('/').filter(s => s.length > 0);
      hashSegments.forEach((segment, index) => {
        const volatileSegment = VolatileSegment.analyze(segment, index, {
          pathname: this.fragment,
          isHashFragment: true
        });
        
        if (volatileSegment) {
          volatileSegments.push(volatileSegment);
        }
      });
    }
    
    return volatileSegments;
  }

  private generatePattern(options?: Partial<PatternGenerationOptions>): string {
    const opts: PatternGenerationOptions = {
      aggressiveness: 'moderate',
      preserveQuery: false,
      preserveHash: false,
      maxWildcards: 5,
      minConfidence: 0.7,
      ...options
    };
    
    // Handle SPA with hash router
    if (this.hasHashRouter && opts.aggressiveness !== 'conservative') {
      return `${this._components.origin}${this._components.pathname}#/**`;
    }
    
    // Handle contains pattern for complex domains
    if (this._components.hostname.split('.').length > 3 && opts.aggressiveness === 'aggressive') {
      return `*${this._components.hostname.split('.').slice(-2).join('.')}*`;
    }
    
    // Generate wildcard pattern
    const segments = this.getSegments();
    const patternSegments = segments.map((segment, index) => {
      const isVolatile = this._volatileSegments.some(vs => vs.position === index);
      return isVolatile ? '*' : segment;
    });
    
    const patternPath = '/' + patternSegments.join('/');
    let pattern = `${this._components.origin}${patternPath}`;
    
    // Add query params if preserving
    if (opts.preserveQuery && this.hasQueryParams) {
      pattern += this._components.search;
    }
    
    // Add hash if preserving
    if (opts.preserveHash && this.hasHashFragment && !this.hasHashRouter) {
      pattern += this._components.hash;
    }
    
    return pattern;
  }

  private determineMatchType(): PatternMatchType {
    if (this._volatileSegments.length === 0) {
      return 'exact';
    }
    
    if (this.hasHashRouter) {
      return 'wildcard'; // Using ignore-after pattern
    }
    
    if (this._components.hostname.split('.').length > 3) {
      return 'contains';
    }
    
    return 'wildcard';
  }

  private calculateConfidence(): number {
    let confidence = 0.5; // Base confidence
    
    // Static URLs have high confidence
    if (this.isStatic) {
      confidence += 0.4;
    }
    
    // Fewer volatile segments = higher confidence
    confidence += Math.max(0, (5 - this._volatileSegments.length) * 0.1);
    
    // Known patterns boost confidence
    if (this.hasHashRouter) confidence += 0.2;
    if (this.isAPI) confidence += 0.15;
    
    // Development URLs have lower confidence
    if (this.isDevelopment) confidence -= 0.1;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private validatePattern(): PatternValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Check for too many wildcards
    const wildcardCount = (this._generatedPattern.match(/\*/g) || []).length;
    if (wildcardCount > 5) {
      warnings.push(`Pattern has ${wildcardCount} wildcards - may be too broad`);
      suggestions.push('Consider using more specific patterns or contains matching');
    }
    
    // Check for development URLs
    if (this.isDevelopment) {
      warnings.push('Development URL detected - pattern may not work in production');
      suggestions.push('Test pattern with production URLs');
    }
    
    // Check for overly specific patterns
    if (this._volatileSegments.length === 0 && this._urlType === 'dynamic') {
      warnings.push('No volatile segments detected in potentially dynamic URL');
      suggestions.push('Review URL for IDs, timestamps, or other changing values');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private generateRegexPattern(): string {
    const segments = this.getSegments();
    const regexSegments = segments.map((segment, index) => {
      const volatileSegment = this._volatileSegments.find(vs => vs.position === index);
      
      if (volatileSegment) {
        return volatileSegment.getRegexPattern();
      }
      
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
    });
    
    return `^${this._components.origin}/${regexSegments.join('/')}$`;
  }

  private generateExampleValue(type: string, variation: number): string {
    const examples: Record<string, string[]> = {
      'numeric-id': ['12345', '67890', '11111'],
      'guid': ['12345678-1234-5678-9abc-123456789012', 'abcdef01-2345-6789-abcd-ef0123456789', '98765432-abcd-ef01-2345-6789abcdef01'],
      'alphanumeric-id': ['abc123', 'xyz789', 'def456'],
      'workspace-id': ['ws_abc123', 'ws_xyz789', 'ws_def456'],
      'user-id': ['user_123', 'user_456', 'user_789'],
      'version': ['v1.2.3', 'v2.0.1', 'v1.5.0'],
      'timestamp': ['1623456789', '1623456790', '1623456791']
    };
    
    const typeExamples = examples[type] || ['example1', 'example2', 'example3'];
    return typeExamples[variation % typeExamples.length];
  }

  private generateExampleHashPath(variation: number): string {
    const examples = ['users/456/profile', 'settings/account', 'dashboard/analytics'];
    return examples[variation % examples.length];
  }

  private matchesWildcardPattern(testURL: string): boolean {
    try {
      const testComponents = this.parseURL(testURL);
      
      if (testComponents.origin !== this._components.origin) {
        return false;
      }
      
      const testSegments = testComponents.pathname.split('/').filter(s => s.length > 0);
      const patternSegments = this._generatedPattern.split('/').filter(s => s.length > 0);
      
      if (testSegments.length !== patternSegments.length) {
        return false;
      }
      
      return patternSegments.every((pattern, index) => {
        return pattern === '*' || pattern === testSegments[index];
      });
    } catch {
      return false;
    }
  }

  // Utility methods
  toString(): string {
    return `URLPattern(${this._originalURL} → ${this._generatedPattern})`;
  }

  toJSON(): object {
    return {
      originalURL: this._originalURL,
      generatedPattern: this._generatedPattern,
      matchType: this._matchType,
      confidence: this._confidence,
      urlType: this._urlType,
      environment: this._environment,
      volatileSegments: this._volatileSegments.map(vs => vs.toJSON()),
      validation: this._validation
    };
  }
}