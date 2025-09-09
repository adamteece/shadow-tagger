// T017: Integration test clipboard copy operations
// This test MUST FAIL until clipboard utilities are implemented

import { ClipboardUtils } from '../../src/utils/ClipboardUtils';
import { MockExtensionAPI } from '../mocks/MockExtensionAPI';

describe('Clipboard Copy Integration', () => {
  let clipboardUtils: ClipboardUtils;
  let mockExtensionAPI: MockExtensionAPI;

  beforeEach(() => {
    mockExtensionAPI = new MockExtensionAPI();
    clipboardUtils = new ClipboardUtils(mockExtensionAPI);
    
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined)
      },
      writable: true
    });
  });

  describe('CSS Selector copying', () => {
    it('should copy simple CSS selector with success feedback', async () => {
      const selector = '#submit-button';
      const metadata = {
        type: 'css-selector',
        isStable: true,
        shadowAware: false,
        explanation: 'Stable ID selector'
      };

      const result = await clipboardUtils.copySelector(selector, metadata);
      
      expect(result.success).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(selector);
      expect(result.copiedText).toBe(selector);
      expect(result.format).toBe('css-selector');
      expect(result.feedback).toContain('Copied CSS selector');
    });

    it('should copy shadow DOM selector with appropriate warnings', async () => {
      const shadowSelector = '#host-element .internal-button';
      const metadata = {
        type: 'css-selector',
        isStable: true,
        shadowAware: true,
        explanation: 'Shadow DOM selector using host + internal path',
        warnings: ['Ensure shadow root is open', 'Verify shadow DOM structure stability']
      };

      const result = await clipboardUtils.copySelector(shadowSelector, metadata);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(shadowSelector);
      expect(result.warnings).toEqual(metadata.warnings);
      expect(result.feedback).toContain('Shadow DOM selector copied');
      expect(result.instructions).toContain('Pendo Custom CSS');
    });

    it('should copy unstable selector with fragility warnings', async () => {
      const unstableSelector = 'div > div:nth-child(3) > button';
      const metadata = {
        type: 'css-selector',
        isStable: false,
        shadowAware: false,
        explanation: 'Position-based selector (fragile)',
        warnings: ['May break with DOM changes', 'Consider adding stable attributes']
      };

      const result = await clipboardUtils.copySelector(unstableSelector, metadata);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(unstableSelector);
      expect(result.warnings).toContain('May break with DOM changes');
      expect(result.feedback).toContain('Fragile selector copied');
    });
  });

  describe('URL Pattern copying', () => {
    it('should copy URL pattern with example explanation', async () => {
      const urlPattern = 'https://app.example.com/account/*/dashboard';
      const metadata = {
        type: 'url-pattern',
        originalURL: 'https://app.example.com/account/12345/dashboard',
        confidence: 0.95,
        volatileSegments: [{
          type: 'numeric-id',
          value: '12345',
          position: 2
        }],
        examples: [
          'https://app.example.com/account/67890/dashboard',
          'https://app.example.com/account/11111/dashboard'
        ]
      };

      const result = await clipboardUtils.copyURLPattern(urlPattern, metadata);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(urlPattern);
      expect(result.format).toBe('url-pattern');
      expect(result.feedback).toContain('URL pattern copied');
      expect(result.instructions).toContain('Pendo Page rule');
    });

    it('should copy hash router pattern with SPA instructions', async () => {
      const hashPattern = 'https://spa.example.com/app#/**';
      const metadata = {
        type: 'url-pattern',
        originalURL: 'https://spa.example.com/app#/users/123/profile',
        hasHashRouter: true,
        patternType: 'ignore-after',
        examples: [
          'https://spa.example.com/app#/users/456/profile',
          'https://spa.example.com/app#/settings',
          'https://spa.example.com/app#/dashboard'
        ]
      };

      const result = await clipboardUtils.copyURLPattern(hashPattern, metadata);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(hashPattern);
      expect(result.instructions).toContain('ignore-after');
      expect(result.instructions).toContain('SPA routing');
      expect(result.warnings).toContain('hash router');
    });

    it('should copy contains pattern with flexibility explanation', async () => {
      const containsPattern = '*dynamic-app.com*';
      const metadata = {
        type: 'url-pattern',
        originalURL: 'https://cdn-v2.dynamic-app.com/assets/bundle.js',
        matchType: 'contains',
        confidence: 0.80,
        examples: [
          'https://subdomain.dynamic-app.com/path',
          'https://dynamic-app.com/different/route'
        ]
      };

      const result = await clipboardUtils.copyURLPattern(containsPattern, metadata);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(containsPattern);
      expect(result.instructions).toContain('flexible matching');
      expect(result.feedback).toContain('Contains pattern copied');
    });
  });

  describe('Formatted copy operations', () => {
    it('should copy with Pendo-specific formatting', async () => {
      const selector = '[data-testid="user-profile-button"]';
      const pendoFormat = {
        selector: selector,
        instructions: 'Copy this selector into Pendo\'s "Custom CSS" field when creating a Feature',
        compatibility: 'Standard CSS selector compatible with all Pendo versions',
        warnings: []
      };

      const result = await clipboardUtils.copyPendoFormatted(pendoFormat);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(selector);
      expect(result.format).toBe('pendo-feature');
      expect(result.instructions).toContain('Custom CSS');
      expect(result.instructions).toContain('Feature');
    });

    it('should copy URL pattern with Pendo Page rule formatting', async () => {
      const urlPattern = 'https://app.example.com/org/*/project/*';
      const pendoFormat = {
        urlPattern: urlPattern,
        ruleType: 'page',
        instructions: 'Copy this pattern into Pendo\'s "Page" field when creating a Page rule',
        explanation: 'Matches pages with dynamic organization and project IDs',
        examples: [
          'https://app.example.com/org/123/project/456',
          'https://app.example.com/org/789/project/abc'
        ]
      };

      const result = await clipboardUtils.copyPendoFormatted(pendoFormat);
      
      expect(result.success).toBe(true);
      expect(result.copiedText).toBe(urlPattern);
      expect(result.format).toBe('pendo-page');
      expect(result.instructions).toContain('Page rule');
    });
  });

  describe('Copy feedback and notifications', () => {
    it('should provide immediate visual feedback on copy success', async () => {
      const selector = '.success-test';
      
      const result = await clipboardUtils.copySelector(selector, { type: 'css-selector' });
      
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.feedback).toBeDefined();
      
      // Should trigger UI feedback
      expect(mockExtensionAPI.sentMessages).toContainEqual({
        type: 'SHOW_COPY_FEEDBACK',
        payload: {
          success: true,
          text: 'CSS selector copied to clipboard'
        }
      });
    });

    it('should handle clipboard permission errors gracefully', async () => {
      // Mock clipboard permission denied
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(
        new Error('Clipboard access denied')
      );

      const result = await clipboardUtils.copySelector('#test', { type: 'css-selector' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Clipboard access denied');
      expect(result.fallbackUsed).toBe(true);
      
      // Should use fallback method
      expect(mockExtensionAPI.sentMessages).toContainEqual({
        type: 'FALLBACK_COPY',
        payload: {
          text: '#test',
          reason: 'clipboard_permission_denied'
        }
      });
    });

    it('should provide copy history for recent operations', async () => {
      // Copy multiple items
      await clipboardUtils.copySelector('#first', { type: 'css-selector' });
      await clipboardUtils.copyURLPattern('https://example.com/*', { type: 'url-pattern' });
      await clipboardUtils.copySelector('.third', { type: 'css-selector' });
      
      const history = clipboardUtils.getCopyHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].text).toBe('.third'); // Most recent first
      expect(history[1].text).toBe('https://example.com/*');
      expect(history[2].text).toBe('#first');
      
      expect(history[0].format).toBe('css-selector');
      expect(history[1].format).toBe('url-pattern');
    });
  });

  describe('Extension integration', () => {
    it('should coordinate with background script for persistent storage', async () => {
      const selector = '#persistent-test';
      const metadata = {
        type: 'css-selector',
        persistToHistory: true
      };

      await clipboardUtils.copySelector(selector, metadata);
      
      expect(mockExtensionAPI.sentMessages).toContainEqual({
        type: 'PERSIST_COPY_HISTORY',
        payload: {
          item: {
            text: selector,
            format: 'css-selector',
            timestamp: expect.any(Date)
          }
        }
      });
    });

    it('should handle cross-tab copy notifications', async () => {
      const copyEvent = {
        type: 'COPY_NOTIFICATION',
        payload: {
          text: '.copied-in-other-tab',
          format: 'css-selector',
          tabId: 'tab-456'
        }
      };

      await clipboardUtils.handleCrossTabCopy(copyEvent);
      
      const history = clipboardUtils.getCopyHistory();
      expect(history[0].text).toBe('.copied-in-other-tab');
      expect(history[0].sourceTab).toBe('tab-456');
    });
  });

  describe('Error recovery', () => {
    it('should fallback to manual copy instructions when all methods fail', async () => {
      // Mock all clipboard methods failing
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('All methods failed'));
      mockExtensionAPI.simulateError = true;

      const result = await clipboardUtils.copySelector('#fallback-test', { type: 'css-selector' });
      
      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toBeDefined();
      expect(result.fallbackInstructions).toContain('manually select and copy');
      expect(result.fallbackInstructions).toContain('#fallback-test');
    });
  });
});