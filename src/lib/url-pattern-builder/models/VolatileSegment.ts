// T023: VolatileSegment model for identifying dynamic URL segments
// Represents a URL segment that changes between requests and should be wildcarded

export type SegmentType = 
  | 'numeric-id' 
  | 'guid' 
  | 'uuid'
  | 'alphanumeric-id'
  | 'workspace-id'
  | 'user-id'
  | 'component-id'
  | 'feature-id'
  | 'session-id'
  | 'timestamp'
  | 'version'
  | 'build-id'
  | 'hash'
  | 'token'
  | 'unknown';

export interface SegmentContext {
  pathname: string;
  isHashFragment: boolean;
  previousSegment?: string;
  nextSegment?: string;
  hostDomain?: string;
}

export interface SegmentAnalysis {
  confidence: number;
  pattern: RegExp;
  examples: string[];
  explanation: string;
  isVolatile: boolean;
  stability: 'stable' | 'semi-stable' | 'volatile' | 'highly-volatile';
}

export interface SegmentValidation {
  isValid: boolean;
  reasons: string[];
  suggestions: string[];
}

export class VolatileSegment {
  private _value: string;
  private _type: SegmentType;
  private _position: number;
  private _context: SegmentContext;
  private _analysis: SegmentAnalysis;
  private _validation: SegmentValidation;
  private _inHashFragment: boolean;

  constructor(value: string, type: SegmentType, position: number, context: SegmentContext) {
    this._value = value;
    this._type = type;
    this._position = position;
    this._context = context;
    this._inHashFragment = context.isHashFragment;
    this._analysis = this.analyzeSegment();
    this._validation = this.validateSegment();
  }

  // Static factory method
  static analyze(segment: string, position: number, context: SegmentContext): VolatileSegment | null {
    const type = this.identifySegmentType(segment, context);
    
    if (type === 'unknown') {
      return null; // Not a volatile segment
    }
    
    return new VolatileSegment(segment, type, position, context);
  }

  // Getters
  get value(): string {
    return this._value;
  }

  get type(): SegmentType {
    return this._type;
  }

  get position(): number {
    return this._position;
  }

  get context(): SegmentContext {
    return { ...this._context };
  }

  get analysis(): SegmentAnalysis {
    return {
      ...this._analysis,
      examples: [...this._analysis.examples]
    };
  }

  get validation(): SegmentValidation {
    return {
      ...this._validation,
      reasons: [...this._validation.reasons],
      suggestions: [...this._validation.suggestions]
    };
  }

  get inHashFragment(): boolean {
    return this._inHashFragment;
  }

  get confidence(): number {
    return this._analysis.confidence;
  }

  get isHighConfidence(): boolean {
    return this._analysis.confidence > 0.8;
  }

  get isVolatile(): boolean {
    return this._analysis.isVolatile;
  }

  get stability(): string {
    return this._analysis.stability;
  }

  get explanation(): string {
    return this._analysis.explanation;
  }

  // Methods
  getRegexPattern(): string {
    switch (this._type) {
      case 'numeric-id':
        return '\\d+';
      case 'guid':
      case 'uuid':
        return '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
      case 'alphanumeric-id':
        return '[a-zA-Z0-9]+';
      case 'workspace-id':
        return 'ws_[a-zA-Z0-9]+';
      case 'user-id':
        return 'user_[a-zA-Z0-9]+';
      case 'component-id':
        return 'comp_[a-zA-Z0-9]+';
      case 'feature-id':
        return 'feat_[a-zA-Z0-9]+';
      case 'session-id':
        return 'sess_[a-zA-Z0-9]+';
      case 'timestamp':
        return '\\d{10,13}';
      case 'version':
        return 'v?\\d+\\.\\d+\\.\\d+';
      case 'build-id':
        return 'build_\\d+';
      case 'hash':
        return '[a-fA-F0-9]{6,64}';
      case 'token':
        return '[a-zA-Z0-9_-]{20,}';
      default:
        return '[^/]+'; // Generic pattern
    }
  }

  getWildcardReplacement(): string {
    return '*';
  }

  generateExamples(count: number = 3): string[] {
    const generators: Record<SegmentType, () => string> = {
      'numeric-id': () => Math.floor(Math.random() * 100000).toString(),
      'guid': () => this.generateGUID(),
      'uuid': () => this.generateGUID(),
      'alphanumeric-id': () => 'abc' + Math.floor(Math.random() * 1000),
      'workspace-id': () => 'ws_' + this.generateRandomString(6),
      'user-id': () => 'user_' + Math.floor(Math.random() * 10000),
      'component-id': () => 'comp_' + this.generateRandomString(6),
      'feature-id': () => 'feat_' + this.generateRandomString(6),
      'session-id': () => 'sess_' + this.generateRandomString(8),
      'timestamp': () => (Date.now() + Math.floor(Math.random() * 86400000)).toString(),
      'version': () => `v${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      'build-id': () => 'build_' + Math.floor(Math.random() * 10000),
      'hash': () => this.generateRandomString(8, '0123456789abcdef'),
      'token': () => this.generateRandomString(32),
      'unknown': () => 'example' + Math.floor(Math.random() * 100)
    };

    const generator = generators[this._type];
    return Array.from({ length: count }, () => generator());
  }

  isLikelyToChange(): boolean {
    const highVolatilityTypes: SegmentType[] = [
      'session-id', 'timestamp', 'token', 'hash', 'build-id'
    ];
    
    return highVolatilityTypes.includes(this._type) || 
           this._analysis.stability === 'highly-volatile';
  }

  isSimilarTo(other: VolatileSegment): boolean {
    if (this._type !== other._type) {
      return false;
    }
    
    // Check if values follow similar patterns
    if (this._type === 'numeric-id') {
      const thisLength = this._value.length;
      const otherLength = other._value.length;
      return Math.abs(thisLength - otherLength) <= 2;
    }
    
    if (this._type === 'alphanumeric-id') {
      return this._value.length === other._value.length;
    }
    
    return true; // Same type is generally similar
  }

  getPendoCompatibility(): {
    compatible: boolean;
    pattern: string;
    explanation: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let pattern = this.getWildcardReplacement();
    
    // Pendo-specific considerations
    if (this._type === 'timestamp') {
      warnings.push('Timestamp segments change frequently - consider if this level of granularity is needed');
    }
    
    if (this._type === 'session-id') {
      warnings.push('Session IDs change on every visit - may result in too many page views');
    }
    
    if (this._inHashFragment) {
      pattern = '**'; // Pendo ignore-after pattern
      warnings.push('Hash fragment detected - using ignore-after pattern');
    }
    
    return {
      compatible: true,
      pattern,
      explanation: `${this._type} segment will be replaced with ${pattern} for flexible matching`,
      warnings
    };
  }

  // Static methods
  static identifySegmentType(segment: string, context: SegmentContext): SegmentType {
    // Order matters - more specific patterns first
    const patterns: Array<{ pattern: RegExp; type: SegmentType; confidence?: number }> = [
      // GUIDs and UUIDs
      { pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, type: 'guid' },
      { pattern: /^[0-9a-f]{32}$/i, type: 'guid' },
      
      // Specific prefixed IDs
      { pattern: /^ws_[a-z0-9]+$/i, type: 'workspace-id' },
      { pattern: /^user_\d+$/i, type: 'user-id' },
      { pattern: /^comp_[a-z0-9]+$/i, type: 'component-id' },
      { pattern: /^feat_[a-z0-9]+$/i, type: 'feature-id' },
      { pattern: /^sess_[a-z0-9]+$/i, type: 'session-id' },
      { pattern: /^build_\d+$/i, type: 'build-id' },
      
      // Versions
      { pattern: /^v?\d+\.\d+\.\d+$/i, type: 'version' },
      
      // Timestamps (10-13 digits)
      { pattern: /^\d{10,13}$/, type: 'timestamp' },
      
      // Long tokens
      { pattern: /^[a-zA-Z0-9_-]{20,}$/, type: 'token' },
      
      // Hex hashes
      { pattern: /^[a-fA-F0-9]{6,64}$/, type: 'hash' },
      
      // Numeric IDs (6+ digits to avoid false positives)
      { pattern: /^\d{6,}$/, type: 'numeric-id' },
      
      // Shorter numeric IDs with context
      { pattern: /^\d{3,5}$/, type: 'numeric-id' },
      
      // Alphanumeric IDs
      { pattern: /^[a-zA-Z]+\d+$/, type: 'alphanumeric-id' },
      { pattern: /^\d+[a-zA-Z]+$/, type: 'alphanumeric-id' },
      { pattern: /^[a-zA-Z0-9]{8,}$/, type: 'alphanumeric-id' }
    ];
    
    for (const { pattern, type } of patterns) {
      if (pattern.test(segment)) {
        // Additional context validation
        if (this.validateWithContext(segment, type, context)) {
          return type;
        }
      }
    }
    
    return 'unknown';
  }

  static validateWithContext(segment: string, type: SegmentType, context: SegmentContext): boolean {
    // Context-based validation to reduce false positives
    
    if (type === 'numeric-id' && segment.length < 6) {
      // Short numeric segments need context validation
      const { previousSegment, nextSegment } = context;
      
      // Check if surrounded by ID-like contexts
      const idContexts = ['user', 'account', 'org', 'project', 'id', 'item'];
      const hasIdContext = idContexts.some(ctx => 
        previousSegment?.toLowerCase().includes(ctx) || 
        nextSegment?.toLowerCase().includes(ctx)
      );
      
      return hasIdContext;
    }
    
    if (type === 'timestamp') {
      // Validate timestamp range (reasonable dates)
      const timestamp = parseInt(segment);
      const now = Date.now();
      const tenYearsAgo = now - (10 * 365 * 24 * 60 * 60 * 1000);
      const tenYearsFromNow = now + (10 * 365 * 24 * 60 * 60 * 1000);
      
      return timestamp >= tenYearsAgo / 1000 && timestamp <= tenYearsFromNow / 1000;
    }
    
    return true; // Default to valid
  }

  // Private methods
  private analyzeSegment(): SegmentAnalysis {
    const confidence = this.calculateConfidence();
    const pattern = new RegExp(this.getRegexPattern());
    const examples = this.generateExamples();
    const explanation = this.generateExplanation();
    const stability = this.determineStability();
    
    return {
      confidence,
      pattern,
      examples,
      explanation,
      isVolatile: confidence > 0.6,
      stability
    };
  }

  private calculateConfidence(): number {
    let confidence = 0.5;
    
    // Type-specific confidence adjustments
    const typeConfidence: Record<SegmentType, number> = {
      'guid': 0.95,
      'uuid': 0.95,
      'timestamp': 0.9,
      'workspace-id': 0.85,
      'user-id': 0.85,
      'component-id': 0.8,
      'feature-id': 0.8,
      'session-id': 0.9,
      'version': 0.7,
      'build-id': 0.8,
      'hash': 0.8,
      'token': 0.85,
      'numeric-id': 0.6,
      'alphanumeric-id': 0.5,
      'unknown': 0.1
    };
    
    confidence = typeConfidence[this._type] || 0.5;
    
    // Context adjustments
    if (this._inHashFragment) {
      confidence *= 0.9; // Slightly less confident in hash fragments
    }
    
    // Length adjustments for generic types
    if (this._type === 'alphanumeric-id') {
      if (this._value.length >= 8) confidence += 0.2;
      if (this._value.length >= 16) confidence += 0.1;
    }
    
    return Math.max(0.1, Math.min(0.99, confidence));
  }

  private determineStability(): 'stable' | 'semi-stable' | 'volatile' | 'highly-volatile' {
    const highlyVolatile: SegmentType[] = ['session-id', 'timestamp', 'token'];
    const volatile: SegmentType[] = ['hash', 'build-id', 'numeric-id'];
    const semiStable: SegmentType[] = ['user-id', 'workspace-id', 'alphanumeric-id'];
    
    if (highlyVolatile.includes(this._type)) return 'highly-volatile';
    if (volatile.includes(this._type)) return 'volatile';
    if (semiStable.includes(this._type)) return 'semi-stable';
    
    return 'stable';
  }

  private generateExplanation(): string {
    const explanations: Record<SegmentType, string> = {
      'numeric-id': 'Numeric identifier that changes between resources',
      'guid': 'Globally unique identifier (GUID)',
      'uuid': 'Universally unique identifier (UUID)',
      'alphanumeric-id': 'Alphanumeric identifier combining letters and numbers',
      'workspace-id': 'Workspace identifier with ws_ prefix',
      'user-id': 'User identifier with user_ prefix',
      'component-id': 'Component identifier with comp_ prefix',
      'feature-id': 'Feature identifier with feat_ prefix',
      'session-id': 'Session identifier that changes per visit',
      'timestamp': 'Unix timestamp that changes over time',
      'version': 'Version number in semantic versioning format',
      'build-id': 'Build identifier with build_ prefix',
      'hash': 'Hexadecimal hash value',
      'token': 'Long authentication or session token',
      'unknown': 'Unknown volatile segment type'
    };
    
    return explanations[this._type];
  }

  private validateSegment(): SegmentValidation {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    
    if (this._analysis.confidence < 0.7) {
      reasons.push('Low confidence in volatility detection');
      suggestions.push('Review segment manually to confirm it should be wildcarded');
    }
    
    if (this._type === 'unknown') {
      reasons.push('Could not determine specific segment type');
      suggestions.push('Consider if this segment truly varies between URLs');
    }
    
    if (this._value.length < 3) {
      reasons.push('Very short segment may not be truly volatile');
      suggestions.push('Verify this segment changes in other similar URLs');
    }
    
    return {
      isValid: reasons.length === 0,
      reasons,
      suggestions
    };
  }

  private generateGUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private generateRandomString(length: number, chars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Utility methods
  toString(): string {
    return `VolatileSegment(${this._value} [${this._type}] @${this._position})`;
  }

  toJSON(): object {
    return {
      value: this._value,
      type: this._type,
      position: this._position,
      inHashFragment: this._inHashFragment,
      confidence: this._analysis.confidence,
      stability: this._analysis.stability,
      explanation: this._analysis.explanation
    };
  }
}