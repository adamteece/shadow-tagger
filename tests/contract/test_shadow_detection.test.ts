// T006: Contract test detectShadowContext() API
// This test MUST FAIL until src/lib/shadow-dom-detector/ShadowDetector.ts is implemented

import { detectShadowContext } from '../../src/lib/shadow-dom-detector/ShadowDetector';
import { ShadowContext } from '../../src/lib/shadow-dom-detector/models/ShadowContext';
import { DOMElement } from '../../src/lib/shadow-dom-detector/models/DOMElement';

describe('Shadow DOM Detection Contract', () => {
  let mockElement: HTMLElement;
  let mockShadowRoot: ShadowRoot;

  beforeEach(() => {
    // Create mock DOM structure for testing
    mockElement = document.createElement('div');
    mockElement.id = 'test-host';
    document.body.appendChild(mockElement);
    
    // Create shadow root (if supported)
    if (mockElement.attachShadow) {
      mockShadowRoot = mockElement.attachShadow({ mode: 'open' });
      const shadowChild = document.createElement('span');
      shadowChild.textContent = 'Shadow content';
      shadowChild.className = 'shadow-child';
      mockShadowRoot.appendChild(shadowChild);
    }
  });

  afterEach(() => {
    document.body.removeChild(mockElement);
  });

  describe('detectShadowContext()', () => {
    it('should detect when element is NOT in shadow DOM', async () => {
      const result = await detectShadowContext(mockElement);
      
      expect(result).toBeInstanceOf(ShadowContext);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isInShadowDOM).toBe(false);
        expect(result.hostElement).toBeNull();
        expect(result.shadowPath).toEqual([]);
      }
    });

    it('should detect when element IS in open shadow DOM', async () => {
      if (!mockShadowRoot) {
        pending('Shadow DOM not supported in test environment');
        return;
      }

      const shadowChild = mockShadowRoot.querySelector('.shadow-child') as HTMLElement;
      const result = await detectShadowContext(shadowChild);
      
      expect(result).toBeInstanceOf(ShadowContext);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isInShadowDOM).toBe(true);
        expect(result.hostElement).toBeInstanceOf(DOMElement);
        expect(result.hostElement?.element).toBe(mockElement);
        expect(result.shadowPath).toHaveLength(1);
        expect(result.shadowPath[0]).toBe(mockShadowRoot);
      }
    });

    it('should handle nested shadow DOMs', async () => {
      if (!mockShadowRoot) {
        pending('Shadow DOM not supported in test environment');
        return;
      }

      // Create nested shadow DOM
      const nestedHost = document.createElement('div');
      nestedHost.id = 'nested-host';
      mockShadowRoot.appendChild(nestedHost);
      
      const nestedShadow = nestedHost.attachShadow({ mode: 'open' });
      const deepChild = document.createElement('button');
      deepChild.textContent = 'Deep shadow button';
      nestedShadow.appendChild(deepChild);

      const result = await detectShadowContext(deepChild);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isInShadowDOM).toBe(true);
        expect(result.shadowPath).toHaveLength(2);
        expect(result.shadowPath[0]).toBe(mockShadowRoot);
        expect(result.shadowPath[1]).toBe(nestedShadow);
      }
    });

    it('should return null for invalid elements', async () => {
      const result = await detectShadowContext(null as any);
      expect(result).toBeNull();
    });

    it('should handle closed shadow DOM gracefully', async () => {
      const closedHost = document.createElement('div');
      document.body.appendChild(closedHost);
      
      try {
        if (closedHost.attachShadow) {
          const closedShadow = closedHost.attachShadow({ mode: 'closed' });
          const closedChild = document.createElement('span');
          closedShadow.appendChild(closedChild);
          
          const result = await detectShadowContext(closedChild);
          expect(result).not.toBeNull();
          if (result) {
            expect(result.isInShadowDOM).toBe(true);
            expect(result.hostElement).toBeInstanceOf(DOMElement);
          }
        }
      } finally {
        document.body.removeChild(closedHost);
      }
    });
  });
});