// T015: Integration test URL pattern generation workflow
// This test MUST FAIL until complete URL workflow is implemented

import { URLPatternWorkflow } from '../../src/workflows/URLPatternWorkflow';

describe('URL Pattern Generation Workflow Integration', () => {
  let workflow: URLPatternWorkflow;

  beforeEach(() => {
    workflow = new URLPatternWorkflow();
  });

  describe('Complete URL pattern generation workflow', () => {
    it('should analyze, generate pattern, and format for Pendo end-to-end', async () => {
      const testURL = 'https://app.saas.com/organization/org_12345/project/proj_abc67/dashboard';
      
      const result = await workflow.analyzeURL(testURL);
      
      expect(result).toBeDefined();
      expect(result.urlPattern.originalURL).toBe(testURL);
      expect(result.urlPattern.generatedPattern).toBe('https://app.saas.com/organization/*/project/*/dashboard');
      expect(result.urlPattern.volatileSegments).toHaveLength(2);
      expect(result.pendoRule.type).toBe('page');
      expect(result.pendoRule.urlPattern).toBe('https://app.saas.com/organization/*/project/*/dashboard');
      expect(result.preview.exampleURLs).toHaveLength(3);
      expect(result.preview.currentURLMatches).toBe(true);
    });

    it('should handle hash router SPAs with ignore-after pattern', async () => {
      const spaURL = 'https://spa.example.com/app#!/users/user_123/profile/settings/security';
      
      const result = await workflow.analyzeURL(spaURL);
      
      expect(result.urlPattern.hasHashBangRouter).toBe(true);
      expect(result.urlPattern.generatedPattern).toBe('https://spa.example.com/app#!/**');
      expect(result.pendoRule.urlPattern).toBe('https://spa.example.com/app#!/**');
      expect(result.pendoRule.explanation).toContain('ignore after');
      expect(result.preview.patternType).toBe('ignore-after');
    });

    it('should identify and handle multiple volatile segment types', async () => {
      const complexURL = 'https://platform.io/tenant/12345/workspace/ws_abc123/build/v2.1.4/component/comp_def456/logs?session=sess_789xyz&timestamp=1623456789';
      
      const result = await workflow.analyzeURL(complexURL);
      
      const segments = result.urlPattern.volatileSegments;
      expect(segments.some(s => s.type === 'numeric-id')).toBe(true);  // 12345
      expect(segments.some(s => s.type === 'workspace-id')).toBe(true); // ws_abc123
      expect(segments.some(s => s.type === 'version')).toBe(true);       // v2.1.4
      expect(segments.some(s => s.type === 'component-id')).toBe(true);  // comp_def456
      
      expect(result.urlPattern.generatedPattern).toBe('https://platform.io/tenant/*/workspace/*/build/*/component/*/logs');
      expect(result.pendoRule.explanation).toContain('multiple wildcards');
    });

    it('should provide accurate preview with example URLs', async () => {
      const originalURL = 'https://dashboard.service.com/account/acc_999/reports/monthly';
      
      const result = await workflow.analyzeURL(originalURL);
      
      expect(result.preview.exampleURLs).toHaveLength(3);
      expect(result.preview.exampleURLs[0]).toMatch(/https:\/\/dashboard\.service\.com\/account\/acc_\d+\/reports\/monthly/);
      expect(result.preview.exampleURLs[1]).toMatch(/https:\/\/dashboard\.service\.com\/account\/acc_\w+\/reports\/monthly/);
      expect(result.preview.currentURLMatches).toBe(true);
      expect(result.preview.flexibilityScore).toBeGreaterThan(0.8);
    });

    it('should handle development and localhost URLs appropriately', async () => {
      const devURL = 'http://localhost:3000/dev/feature/feat_abc123/test';
      
      const result = await workflow.analyzeURL(devURL);
      
      expect(result.urlPattern.isDevelopment).toBe(true);
      expect(result.urlPattern.generatedPattern).toBe('http://localhost:3000/dev/feature/*/test');
      expect(result.pendoRule.warnings).toContain('development environment');
      expect(result.preview.exampleURLs[0]).toContain('localhost:3000');
    });

    it('should handle contains patterns for flexible matching', async () => {
      const dynamicURL = 'https://cdn-v2-prod-east.dynamic-app.com/assets/bundle_abc123.js';
      
      const result = await workflow.analyzeURL(dynamicURL);
      
      expect(result.urlPattern.matchType).toBe('contains');
      expect(result.urlPattern.generatedPattern).toBe('*dynamic-app.com*');
      expect(result.pendoRule.explanation).toContain('contains pattern');
      expect(result.preview.patternType).toBe('contains');
    });

    it('should handle query parameters and fragments appropriately', async () => {
      const urlWithParams = 'https://app.example.com/search?q=test&category=docs&page=2&sort=date#results-section';
      
      const result = await workflow.analyzeURL(urlWithParams);
      
      expect(result.urlPattern.queryParams).toEqual({
        q: 'test',
        category: 'docs', 
        page: '2',
        sort: 'date'
      });
      expect(result.urlPattern.fragment).toBe('results-section');
      expect(result.pendoRule.explanation).toContain('query parameters');
    });

    it('should generate appropriate patterns for static vs dynamic URLs', async () => {
      // Static URL
      const staticURL = 'https://company.com/about/contact';
      const staticResult = await workflow.analyzeURL(staticURL);
      
      expect(staticResult.urlPattern.isStatic).toBe(true);
      expect(staticResult.urlPattern.generatedPattern).toBe(staticURL);
      expect(staticResult.pendoRule.explanation).toContain('exact match');
      
      // Dynamic URL
      const dynamicURL = 'https://company.com/user/user_456/settings';
      const dynamicResult = await workflow.analyzeURL(dynamicURL);
      
      expect(dynamicResult.urlPattern.isStatic).toBe(false);
      expect(dynamicResult.urlPattern.generatedPattern).toBe('https://company.com/user/*/settings');
    });
  });

  describe('URL workflow error handling', () => {
    it('should handle invalid URLs gracefully', async () => {
      const result = await workflow.analyzeURL('not-a-valid-url');
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Invalid URL');
    });

    it('should handle extremely long URLs', async () => {
      const longURL = 'https://example.com/' + 'a'.repeat(2000) + '/path';
      
      const result = await workflow.analyzeURL(longURL);
      
      expect(result.warnings).toContain('extremely long URL');
      expect(result.urlPattern.generatedPattern.length).toBeLessThan(longURL.length);
    });

    it('should handle URLs with unusual characters', async () => {
      const unusualURL = 'https://example.com/path/with%20spaces/and-émojí-🚀/item';
      
      const result = await workflow.analyzeURL(unusualURL);
      
      expect(result.urlPattern.originalURL).toBe(unusualURL);
      expect(result.pendoRule.copyableRule).toBeDefined();
    });
  });

  describe('Current page integration', () => {
    it('should analyze current page URL when requested', async () => {
      // Mock current location
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://current-page.com/section/123/subsection'
        },
        writable: true
      });

      const result = await workflow.analyzeCurrentPage();
      
      expect(result.urlPattern.originalURL).toBe(window.location.href);
      expect(result.preview.currentURLMatches).toBe(true);
    });
  });
});