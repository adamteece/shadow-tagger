// T009: Contract test formatForPendo() API
// This test MUST FAIL until src/lib/pendo-formatter/PendoFormatter.ts is implemented

import { formatForPendo } from '../../src/lib/pendo-formatter/PendoFormatter';
import { PendoRule } from '../../src/lib/pendo-formatter/models/PendoRule';
import { URLPattern } from '../../src/lib/url-pattern-builder/models/URLPattern';
import { CSSSelector } from '../../src/lib/shadow-dom-detector/models/CSSSelector';

describe('Pendo Formatting Contract', () => {
  describe('formatForPendo()', () => {
    it('should format simple CSS selector for Pendo Feature rule', async () => {
      const mockSelector = {
        value: '#submit-button',
        isStable: true,
        specificity: 100,
        shadowAware: false,
        explanation: 'Stable ID selector'
      } as CSSSelector;

      const result = await formatForPendo(mockSelector, 'feature');
      
      expect(result).toBeInstanceOf(PendoRule);
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.type).toBe('feature');
      expect(result.selector).toBe('#submit-button');
      expect(result.isStandard).toBe(true);
      expect(result.explanation).toContain('Pendo Feature');
      expect(result.copyableRule).toBe('#submit-button');
    });

    it('should format shadow DOM selector with proper explanation', async () => {
      const mockSelector = {
        value: '#host-element .internal-button',
        isStable: true,
        specificity: 110,
        shadowAware: true,
        explanation: 'Shadow DOM selector using host element + internal path'
      } as CSSSelector;

      const result = await formatForPendo(mockSelector, 'feature');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.shadowDOMCompatible).toBe(true);
      expect(result.explanation).toContain('shadow DOM');
      expect(result.explanation).toContain('host element');
      expect(result.explanation).toContain('avoid deprecated');
      expect(result.warnings).toContain('Ensure shadow root is open');
    });

    it('should format URL pattern for Pendo Page rule', async () => {
      const mockPattern = {
        originalURL: 'https://app.example.com/account/12345/dashboard',
        generatedPattern: 'https://app.example.com/account/*/dashboard',
        confidence: 0.95,
        volatileSegments: [{
          type: 'numeric-id',
          value: '12345',
          position: 2
        }]
      } as URLPattern;

      const result = await formatForPendo(mockPattern, 'page');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.type).toBe('page');
      expect(result.urlPattern).toBe('https://app.example.com/account/*/dashboard');
      expect(result.explanation).toContain('Page rule');
      expect(result.explanation).toContain('wildcard');
      expect(result.copyableRule).toBe('https://app.example.com/account/*/dashboard');
    });

    it('should handle complex URL patterns with multiple wildcards', async () => {
      const mockPattern = {
        originalURL: 'https://app.example.com/org/123/project/456/feature/789abc',
        generatedPattern: 'https://app.example.com/org/*/project/*/feature/*',
        confidence: 0.88,
        volatileSegments: [{
          type: 'numeric-id',
          value: '123',
          position: 2
        }, {
          type: 'numeric-id', 
          value: '456',
          position: 4
        }, {
          type: 'alphanumeric-id',
          value: '789abc',
          position: 6
        }]
      } as URLPattern;

      const result = await formatForPendo(mockPattern, 'page');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.urlPattern).toBe('https://app.example.com/org/*/project/*/feature/*');
      expect(result.explanation).toContain('multiple wildcards');
      expect(result.confidence).toBe(0.88);
    });

    it('should handle hash router URLs with ignore-after pattern', async () => {
      const mockPattern = {
        originalURL: 'https://spa.example.com/app#/users/123/profile/edit',
        generatedPattern: 'https://spa.example.com/app#/**',
        confidence: 0.92,
        hasHashRouter: true,
        hashFragment: '/users/123/profile/edit'
      } as URLPattern;

      const result = await formatForPendo(mockPattern, 'page');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.urlPattern).toBe('https://spa.example.com/app#/**');
      expect(result.explanation).toContain('hash router');
      expect(result.explanation).toContain('ignore after');
      expect(result.warnings).toContain('SPA routing');
    });

    it('should provide warnings for unstable selectors', async () => {
      const mockSelector = {
        value: 'body > div:nth-child(3) > span.dynamic-class',
        isStable: false,
        specificity: 30,
        shadowAware: false,
        explanation: 'Position-based selector (fragile)'
      } as CSSSelector;

      const result = await formatForPendo(mockSelector, 'feature');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.isStandard).toBe(true);
      expect(result.warnings).toContain('fragile');
      expect(result.warnings).toContain('position-based');
      expect(result.explanation).toContain('may break');
    });

    it('should format "contains" URL patterns for flexible matching', async () => {
      const mockPattern = {
        originalURL: 'https://dynamic.app.com/complex/path/with/123/segments',
        generatedPattern: '*dynamic.app.com*',
        confidence: 0.75,
        matchType: 'contains'
      } as URLPattern;

      const result = await formatForPendo(mockPattern, 'page');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.urlPattern).toBe('*dynamic.app.com*');
      expect(result.explanation).toContain('contains');
      expect(result.explanation).toContain('flexible');
    });

    it('should return null for invalid input', async () => {
      const result = await formatForPendo(null as any, 'feature');
      expect(result).toBeNull();
    });

    it('should include copy instructions in result', async () => {
      const mockSelector = {
        value: '[data-testid="user-button"]',
        isStable: true,
        specificity: 100,
        shadowAware: false,
        explanation: 'Stable test ID selector'
      } as CSSSelector;

      const result = await formatForPendo(mockSelector, 'feature');
      
      expect(result).not.toBeNull();
      if (!result) return;
      
      expect(result.copyInstructions).toContain('Pendo');
      expect(result.copyInstructions).toContain('Custom CSS');
      expect(result.copyableRule).toBe('[data-testid="user-button"]');
    });
  });
});