// T010: Contract test previewMatches() API
// This test MUST FAIL until src/lib/pendo-formatter/ElementPreview.ts is implemented

import { previewMatches } from '../../src/lib/pendo-formatter/ElementPreview';
import { CSSSelector } from '../../src/lib/shadow-dom-detector/models/CSSSelector';
import { URLPattern } from '../../src/lib/url-pattern-builder/models/URLPattern';

describe('Element Preview Contract', () => {
  let testContainer: HTMLElement;

  beforeEach(() => {
    testContainer = document.createElement('div');
    testContainer.id = 'preview-test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('previewMatches() for CSS selectors', () => {
    it('should count matching elements for simple selector', async () => {
      // Create test elements
      const button1 = document.createElement('button');
      button1.className = 'test-btn';
      const button2 = document.createElement('button');
      button2.className = 'test-btn';
      const button3 = document.createElement('button');
      button3.className = 'other-btn';
      
      testContainer.appendChild(button1);
      testContainer.appendChild(button2);
      testContainer.appendChild(button3);

      const mockSelector = {
        value: '.test-btn',
        isStable: true,
        specificity: 10,
        shadowAware: false
      } as CSSSelector;

      const result = await previewMatches(mockSelector);
      
      expect(result).toBeDefined();
      expect(result.matchCount).toBe(2);
      expect(result.totalElements).toBeGreaterThanOrEqual(2);
      expect(result.matchPercentage).toBeCloseTo(100, 0); // 2/2 matching buttons
      expect(result.elements).toHaveLength(2);
      expect(result.elements[0]).toBe(button1);
      expect(result.elements[1]).toBe(button2);
    });

    it('should handle shadow DOM elements in preview', async () => {
      const host = document.createElement('div');
      host.id = 'shadow-preview-host';
      testContainer.appendChild(host);

      if (host.attachShadow) {
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const shadowButton = document.createElement('button');
        shadowButton.className = 'shadow-test-btn';
        shadowRoot.appendChild(shadowButton);

        const mockSelector = {
          value: '#shadow-preview-host .shadow-test-btn',
          isStable: true,
          specificity: 110,
          shadowAware: true
        } as CSSSelector;

        const result = await previewMatches(mockSelector);
        
        expect(result.matchCount).toBe(1);
        expect(result.shadowDOMElements).toBe(1);
        expect(result.elements[0]).toBe(shadowButton);
        expect(result.warnings).toContain('shadow DOM');
      } else {
        pending('Shadow DOM not supported');
      }
    });

    it('should return zero matches for invalid selector', async () => {
      const mockSelector = {
        value: '#non-existent-element',
        isStable: true,
        specificity: 100,
        shadowAware: false
      } as CSSSelector;

      const result = await previewMatches(mockSelector);
      
      expect(result.matchCount).toBe(0);
      expect(result.elements).toHaveLength(0);
      expect(result.matchPercentage).toBe(0);
    });

    it('should limit preview results to reasonable number', async () => {
      // Create many matching elements
      for (let i = 0; i < 100; i++) {
        const span = document.createElement('span');
        span.className = 'many-elements';
        testContainer.appendChild(span);
      }

      const mockSelector = {
        value: '.many-elements',
        isStable: true,
        specificity: 10,
        shadowAware: false
      } as CSSSelector;

      const result = await previewMatches(mockSelector);
      
      expect(result.matchCount).toBe(100);
      expect(result.elements.length).toBeLessThanOrEqual(50); // Should limit preview
      expect(result.limitReached).toBe(true);
    });
  });

  describe('previewMatches() for URL patterns', () => {
    it('should provide example URLs that match pattern', async () => {
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

      const result = await previewMatches(mockPattern);
      
      expect(result).toBeDefined();
      expect(result.exampleURLs).toHaveLength(3); // Should generate example URLs
      expect(result.exampleURLs[0]).toBe('https://app.example.com/account/67890/dashboard');
      expect(result.exampleURLs[1]).toBe('https://app.example.com/account/11111/dashboard');
      expect(result.currentURLMatches).toBe(true);
    });

    it('should show hash router pattern examples', async () => {
      const mockPattern = {
        originalURL: 'https://spa.example.com/app#/users/123/profile',
        generatedPattern: 'https://spa.example.com/app#/**',
        confidence: 0.90,
        hasHashRouter: true
      } as URLPattern;

      const result = await previewMatches(mockPattern);
      
      expect(result.exampleURLs).toContain('https://spa.example.com/app#/users/456/profile');
      expect(result.exampleURLs).toContain('https://spa.example.com/app#/settings');
      expect(result.exampleURLs).toContain('https://spa.example.com/app#/dashboard/analytics');
      expect(result.patternType).toBe('ignore-after');
    });

    it('should handle contains patterns', async () => {
      const mockPattern = {
        originalURL: 'https://dynamic.app.com/complex/path',
        generatedPattern: '*dynamic.app.com*',
        confidence: 0.80,
        matchType: 'contains'
      } as URLPattern;

      const result = await previewMatches(mockPattern);
      
      expect(result.exampleURLs).toContain('https://subdomain.dynamic.app.com/any/path');
      expect(result.exampleURLs).toContain('https://dynamic.app.com/different/route');
      expect(result.patternType).toBe('contains');
      expect(result.flexibilityScore).toBeGreaterThan(0.7);
    });
  });

  describe('previewMatches() error handling', () => {
    it('should return null for invalid input', async () => {
      const result = await previewMatches(null as any);
      expect(result).toBeNull();
    });

    it('should handle malformed CSS selectors gracefully', async () => {
      const mockSelector = {
        value: '>>invalid>>selector<<',
        isStable: false,
        specificity: 0,
        shadowAware: false
      } as CSSSelector;

      const result = await previewMatches(mockSelector);
      
      expect(result.matchCount).toBe(0);
      expect(result.errors).toContain('Invalid CSS selector');
    });
  });
});