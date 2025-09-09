// T012: Contract test URL analysis message flow
// This test MUST FAIL until messaging system is implemented

import { analyzeURL } from '../../src/messaging/MessageBus';
import { URLAnalysisRequest, URLAnalysisResponse } from '../../src/messaging/types';

describe('URL Analysis Messaging Contract', () => {
  describe('analyzeURL() message flow', () => {
    it('should send URL analysis request and receive response', async () => {
      const testURL = 'https://app.example.com/account/12345/dashboard';
      
      const request: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: testURL,
          includePreview: true
        }
      };

      const response = await analyzeURL(request);
      
      expect(response).toBeDefined();
      expect(response.type).toBe('URL_ANALYSIS_RESULT');
      expect(response.payload.urlPattern).toBeDefined();
      expect(response.payload.pendoRule).toBeDefined();
      expect(response.payload.preview).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.payload.urlPattern.originalURL).toBe(testURL);
    });

    it('should handle complex URLs with multiple volatile segments', async () => {
      const complexURL = 'https://platform.saas.io/org/abc123/workspace/def456/build/789/logs?timestamp=1623456789';
      
      const request: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: complexURL,
          includePreview: true
        }
      };

      const response = await analyzeURL(request);
      
      expect(response.payload.urlPattern.volatileSegments.length).toBeGreaterThan(2);
      expect(response.payload.pendoRule.urlPattern).toContain('*');
      expect(response.payload.preview.exampleURLs).toHaveLength(3);
    });

    it('should handle hash router URLs', async () => {
      const hashURL = 'https://spa.example.com/app#/users/123/profile/edit';
      
      const request: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: hashURL,
          includePreview: true
        }
      };

      const response = await analyzeURL(request);
      
      expect(response.payload.urlPattern.hasHashRouter).toBe(true);
      expect(response.payload.pendoRule.urlPattern).toContain('#/**');
      expect(response.payload.preview.patternType).toBe('ignore-after');
    });

    it('should handle URL analysis errors gracefully', async () => {
      const request: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: 'not-a-valid-url',
          includePreview: false
        }
      };

      const response = await analyzeURL(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Invalid URL');
    });

    it('should support preview toggling in URL requests', async () => {
      const testURL = 'https://example.com/path/123/resource';
      
      const requestWithPreview: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: testURL,
          includePreview: true
        }
      };

      const responseWithPreview = await analyzeURL(requestWithPreview);
      expect(responseWithPreview.payload.preview).toBeDefined();

      const requestWithoutPreview: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: testURL,
          includePreview: false
        }
      };

      const responseWithoutPreview = await analyzeURL(requestWithoutPreview);
      expect(responseWithoutPreview.payload.preview).toBeUndefined();
    });

    it('should handle current page URL analysis', async () => {
      // Mock current location
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://current.example.com/page/456/section'
        },
        writable: true
      });

      const request: URLAnalysisRequest = {
        type: 'ANALYZE_URL',
        payload: {
          url: window.location.href,
          includePreview: true
        }
      };

      const response = await analyzeURL(request);
      
      expect(response.payload.preview.currentURLMatches).toBe(true);
      expect(response.payload.urlPattern.originalURL).toBe(window.location.href);
    });
  });
});