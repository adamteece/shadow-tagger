// T011: Contract test element analysis message flow
// This test MUST FAIL until messaging system is implemented

import { analyzeElement } from '../../src/messaging/MessageBus';
import { ElementAnalysisRequest, ElementAnalysisResponse } from '../../src/messaging/types';

describe('Element Analysis Messaging Contract', () => {
  describe('analyzeElement() message flow', () => {
    it('should send element analysis request and receive response', async () => {
      const mockElement = document.createElement('button');
      mockElement.id = 'test-button';
      mockElement.setAttribute('data-testid', 'submit');
      document.body.appendChild(mockElement);

      try {
        const request: ElementAnalysisRequest = {
          type: 'ANALYZE_ELEMENT',
          payload: {
            element: mockElement,
            includePreview: true
          }
        };

        const response = await analyzeElement(request);
        
        expect(response).toBeDefined();
        expect(response.type).toBe('ELEMENT_ANALYSIS_RESULT');
        expect(response.payload.shadowContext).toBeDefined();
        expect(response.payload.cssSelector).toBeDefined();
        expect(response.payload.pendoRule).toBeDefined();
        expect(response.payload.preview).toBeDefined();
        expect(response.success).toBe(true);
      } finally {
        document.body.removeChild(mockElement);
      }
    });

    it('should handle shadow DOM element analysis requests', async () => {
      const host = document.createElement('div');
      host.id = 'shadow-host';
      document.body.appendChild(host);

      try {
        if (host.attachShadow) {
          const shadowRoot = host.attachShadow({ mode: 'open' });
          const shadowButton = document.createElement('button');
          shadowButton.className = 'shadow-btn';
          shadowRoot.appendChild(shadowButton);

          const request: ElementAnalysisRequest = {
            type: 'ANALYZE_ELEMENT',
            payload: {
              element: shadowButton,
              includePreview: true
            }
          };

          const response = await analyzeElement(request);
          
          expect(response.payload.shadowContext.isInShadowDOM).toBe(true);
          expect(response.payload.cssSelector.shadowAware).toBe(true);
          expect(response.payload.pendoRule.shadowDOMCompatible).toBe(true);
        } else {
          pending('Shadow DOM not supported');
        }
      } finally {
        document.body.removeChild(host);
      }
    });

    it('should handle analysis errors gracefully', async () => {
      const request: ElementAnalysisRequest = {
        type: 'ANALYZE_ELEMENT',
        payload: {
          element: null as any,
          includePreview: false
        }
      };

      const response = await analyzeElement(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Invalid element');
    });

    it('should support preview toggling in requests', async () => {
      const mockElement = document.createElement('div');
      mockElement.className = 'test-div';
      document.body.appendChild(mockElement);

      try {
        const requestWithPreview: ElementAnalysisRequest = {
          type: 'ANALYZE_ELEMENT',
          payload: {
            element: mockElement,
            includePreview: true
          }
        };

        const responseWithPreview = await analyzeElement(requestWithPreview);
        expect(responseWithPreview.payload.preview).toBeDefined();

        const requestWithoutPreview: ElementAnalysisRequest = {
          type: 'ANALYZE_ELEMENT',
          payload: {
            element: mockElement,
            includePreview: false
          }
        };

        const responseWithoutPreview = await analyzeElement(requestWithoutPreview);
        expect(responseWithoutPreview.payload.preview).toBeUndefined();
      } finally {
        document.body.removeChild(mockElement);
      }
    });
  });
});