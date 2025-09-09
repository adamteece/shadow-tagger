// T016: Integration test popup UI interactions
// This test MUST FAIL until popup UI is implemented

import { PopupController } from '../../src/popup/popup';
import { MockExtensionAPI } from '../mocks/MockExtensionAPI';

describe('Popup UI Integration', () => {
  let popupController: PopupController;
  let mockExtensionAPI: MockExtensionAPI;
  let popupContainer: HTMLElement;

  beforeEach(() => {
    // Setup popup DOM structure
    popupContainer = document.createElement('div');
    popupContainer.innerHTML = `
      <div id="popup-container">
        <div id="feature-selector">
          <button id="shadow-dom-btn" class="feature-btn">Shadow DOM Helper</button>
          <button id="url-pattern-btn" class="feature-btn">URL Pattern Builder</button>
        </div>
        <div id="results-container">
          <div id="element-analysis-result"></div>
          <div id="url-analysis-result"></div>
          <div id="preview-section"></div>
        </div>
        <div id="actions-container">
          <button id="copy-selector-btn">Copy Selector</button>
          <button id="copy-url-pattern-btn">Copy URL Pattern</button>
          <button id="activate-picker-btn">Activate Element Picker</button>
        </div>
      </div>
    `;
    document.body.appendChild(popupContainer);

    mockExtensionAPI = new MockExtensionAPI();
    popupController = new PopupController(mockExtensionAPI);
  });

  afterEach(() => {
    document.body.removeChild(popupContainer);
  });

  describe('Feature switching', () => {
    it('should switch between shadow DOM and URL pattern features', async () => {
      await popupController.initialize();
      
      // Test shadow DOM feature activation
      const shadowBtn = document.getElementById('shadow-dom-btn') as HTMLButtonElement;
      shadowBtn.click();
      
      expect(popupController.activeFeature).toBe('shadow-dom');
      expect(shadowBtn.classList.contains('active')).toBe(true);
      expect(document.getElementById('element-analysis-result')?.style.display).toBe('block');
      expect(document.getElementById('url-analysis-result')?.style.display).toBe('none');
      
      // Test URL pattern feature activation
      const urlBtn = document.getElementById('url-pattern-btn') as HTMLButtonElement;
      urlBtn.click();
      
      expect(popupController.activeFeature).toBe('url-pattern');
      expect(urlBtn.classList.contains('active')).toBe(true);
      expect(document.getElementById('element-analysis-result')?.style.display).toBe('none');
      expect(document.getElementById('url-analysis-result')?.style.display).toBe('block');
    });

    it('should persist feature selection across popup sessions', async () => {
      await popupController.initialize();
      
      // Select URL pattern feature
      const urlBtn = document.getElementById('url-pattern-btn') as HTMLButtonElement;
      urlBtn.click();
      
      // Simulate popup close and reopen
      await popupController.saveState();
      const newPopupController = new PopupController(mockExtensionAPI);
      await newPopupController.initialize();
      
      expect(newPopupController.activeFeature).toBe('url-pattern');
    });
  });

  describe('Element analysis display', () => {
    it('should display shadow DOM analysis results properly', async () => {
      await popupController.initialize();
      
      const mockAnalysisResult = {
        shadowContext: {
          isInShadowDOM: true,
          hostElement: { tagName: 'div', id: 'host-element' },
          shadowPath: ['ShadowRoot']
        },
        cssSelector: {
          value: '#host-element .internal-button',
          isStable: true,
          shadowAware: true,
          explanation: 'Shadow DOM selector using host element'
        },
        pendoRule: {
          type: 'feature',
          selector: '#host-element .internal-button',
          shadowDOMCompatible: true,
          copyableRule: '#host-element .internal-button'
        },
        preview: {
          matchCount: 1,
          elements: ['button element']
        }
      };

      await popupController.displayElementAnalysis(mockAnalysisResult);
      
      const resultContainer = document.getElementById('element-analysis-result');
      expect(resultContainer?.textContent).toContain('Shadow DOM detected');
      expect(resultContainer?.textContent).toContain('#host-element .internal-button');
      expect(resultContainer?.textContent).toContain('1 element matches');
      
      const copyBtn = document.getElementById('copy-selector-btn') as HTMLButtonElement;
      expect(copyBtn?.disabled).toBe(false);
    });

    it('should display regular DOM analysis results', async () => {
      await popupController.initialize();
      
      const mockAnalysisResult = {
        shadowContext: {
          isInShadowDOM: false,
          hostElement: null,
          shadowPath: []
        },
        cssSelector: {
          value: '#submit-button',
          isStable: true,
          shadowAware: false,
          explanation: 'Stable ID selector'
        },
        pendoRule: {
          type: 'feature',
          selector: '#submit-button',
          shadowDOMCompatible: false,
          copyableRule: '#submit-button'
        },
        preview: {
          matchCount: 1,
          elements: ['button#submit-button']
        }
      };

      await popupController.displayElementAnalysis(mockAnalysisResult);
      
      const resultContainer = document.getElementById('element-analysis-result');
      expect(resultContainer?.textContent).toContain('Regular DOM element');
      expect(resultContainer?.textContent).toContain('#submit-button');
      expect(resultContainer?.textContent).not.toContain('Shadow DOM');
    });
  });

  describe('URL pattern display', () => {
    it('should display URL pattern analysis results', async () => {
      await popupController.initialize();
      
      const mockURLResult = {
        urlPattern: {
          originalURL: 'https://app.example.com/account/12345/dashboard',
          generatedPattern: 'https://app.example.com/account/*/dashboard',
          volatileSegments: [{
            type: 'numeric-id',
            value: '12345',
            position: 2
          }]
        },
        pendoRule: {
          type: 'page',
          urlPattern: 'https://app.example.com/account/*/dashboard',
          explanation: 'Page rule with wildcard for account ID'
        },
        preview: {
          exampleURLs: [
            'https://app.example.com/account/67890/dashboard',
            'https://app.example.com/account/11111/dashboard'
          ],
          currentURLMatches: true
        }
      };

      await popupController.displayURLAnalysis(mockURLResult);
      
      const resultContainer = document.getElementById('url-analysis-result');
      expect(resultContainer?.textContent).toContain('https://app.example.com/account/*/dashboard');
      expect(resultContainer?.textContent).toContain('account ID');
      expect(resultContainer?.textContent).toContain('Current URL matches');
      
      const copyBtn = document.getElementById('copy-url-pattern-btn') as HTMLButtonElement;
      expect(copyBtn?.disabled).toBe(false);
    });

    it('should display hash router patterns appropriately', async () => {
      await popupController.initialize();
      
      const mockHashResult = {
        urlPattern: {
          originalURL: 'https://spa.example.com/app#/users/123/profile',
          generatedPattern: 'https://spa.example.com/app#/**',
          hasHashRouter: true
        },
        pendoRule: {
          type: 'page',
          urlPattern: 'https://spa.example.com/app#/**',
          explanation: 'SPA pattern using ignore-after for hash routing'
        },
        preview: {
          patternType: 'ignore-after',
          exampleURLs: [
            'https://spa.example.com/app#/users/456/profile',
            'https://spa.example.com/app#/settings'
          ]
        }
      };

      await popupController.displayURLAnalysis(mockHashResult);
      
      const resultContainer = document.getElementById('url-analysis-result');
      expect(resultContainer?.textContent).toContain('ignore-after');
      expect(resultContainer?.textContent).toContain('hash routing');
    });
  });

  describe('Element picker integration', () => {
    it('should activate element picker when button clicked', async () => {
      await popupController.initialize();
      
      const pickerBtn = document.getElementById('activate-picker-btn') as HTMLButtonElement;
      pickerBtn.click();
      
      expect(mockExtensionAPI.sentMessages).toContainEqual({
        type: 'ACTIVATE_PICKER',
        payload: { mode: 'shadow-aware' }
      });
      expect(pickerBtn.textContent).toBe('Picker Active...');
      expect(pickerBtn.disabled).toBe(true);
    });

    it('should handle picker selection results', async () => {
      await popupController.initialize();
      
      const mockPickerResult = {
        element: 'button.selected-element',
        analysisResult: {
          shadowContext: { isInShadowDOM: false },
          cssSelector: { value: '.selected-element' },
          pendoRule: { copyableRule: '.selected-element' }
        }
      };

      await popupController.handlePickerResult(mockPickerResult);
      
      const resultContainer = document.getElementById('element-analysis-result');
      expect(resultContainer?.textContent).toContain('.selected-element');
      
      const pickerBtn = document.getElementById('activate-picker-btn') as HTMLButtonElement;
      expect(pickerBtn.textContent).toBe('Activate Element Picker');
      expect(pickerBtn.disabled).toBe(false);
    });
  });

  describe('Preview functionality', () => {
    it('should display element match previews', async () => {
      await popupController.initialize();
      
      const mockPreview = {
        matchCount: 3,
        totalElements: 10,
        matchPercentage: 30,
        elements: ['button.btn', 'button.btn', 'button.btn'],
        limitReached: false
      };

      await popupController.displayPreview(mockPreview, 'element');
      
      const previewSection = document.getElementById('preview-section');
      expect(previewSection?.textContent).toContain('3 elements match');
      expect(previewSection?.textContent).toContain('30%');
    });

    it('should display URL pattern examples', async () => {
      await popupController.initialize();
      
      const mockPreview = {
        exampleURLs: [
          'https://example.com/user/123/profile',
          'https://example.com/user/456/profile',
          'https://example.com/user/789/profile'
        ],
        currentURLMatches: true,
        patternType: 'wildcard'
      };

      await popupController.displayPreview(mockPreview, 'url');
      
      const previewSection = document.getElementById('preview-section');
      expect(previewSection?.textContent).toContain('Example URLs');
      expect(previewSection?.textContent).toContain('https://example.com/user/123/profile');
      expect(previewSection?.textContent).toContain('Current URL matches');
    });
  });

  describe('Error handling', () => {
    it('should display analysis errors appropriately', async () => {
      await popupController.initialize();
      
      const errorResult = {
        error: {
          message: 'Unable to analyze element',
          type: 'ANALYSIS_ERROR'
        }
      };

      await popupController.displayError(errorResult.error);
      
      const resultContainer = document.getElementById('element-analysis-result');
      expect(resultContainer?.classList.contains('error')).toBe(true);
      expect(resultContainer?.textContent).toContain('Unable to analyze element');
    });

    it('should handle extension API communication errors', async () => {
      mockExtensionAPI.simulateError = true;
      
      await popupController.initialize();
      
      const pickerBtn = document.getElementById('activate-picker-btn') as HTMLButtonElement;
      pickerBtn.click();
      
      // Should show error state
      expect(document.querySelector('.error-message')?.textContent)
        .toContain('Communication error');
    });
  });
});