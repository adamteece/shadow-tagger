// T007: Contract test generateSelector() API
// This test MUST FAIL until src/lib/shadow-dom-detector/SelectorGenerator.ts is implemented

import { generateSelector } from '../../src/lib/shadow-dom-detector/SelectorGenerator';
import { ShadowContext } from '../../src/lib/shadow-dom-detector/models/ShadowContext';
import { DOMElement } from '../../src/lib/shadow-dom-detector/models/DOMElement';
import { CSSSelector } from '../../src/lib/shadow-dom-detector/models/CSSSelector';

describe('CSS Selector Generation Contract', () => {
  let testContainer: HTMLElement;

  beforeEach(() => {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('generateSelector()', () => {
    it('should generate simple selector for regular DOM element', async () => {
      const button = document.createElement('button');
      button.id = 'submit-btn';
      button.className = 'primary-button';
      testContainer.appendChild(button);

      const context = new ShadowContext({
        isInShadowDOM: false,
        hostElement: null,
        shadowPath: [],
        targetElement: new DOMElement(button)
      });

      const result = await generateSelector(context);
      
      expect(result).toBeInstanceOf(CSSSelector);
      expect(result.value).toBe('#submit-btn');
      expect(result.isStable).toBe(true);
      expect(result.specificity).toBeGreaterThan(0);
      expect(result.shadowAware).toBe(false);
    });

    it('should generate shadow-aware selector for shadow DOM element', async () => {
      const host = document.createElement('div');
      host.id = 'shadow-host';
      testContainer.appendChild(host);

      if (host.attachShadow) {
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const shadowButton = document.createElement('button');
        shadowButton.className = 'shadow-btn';
        shadowButton.setAttribute('data-testid', 'shadow-button');
        shadowRoot.appendChild(shadowButton);

        const context = new ShadowContext({
          isInShadowDOM: true,
          hostElement: new DOMElement(host),
          shadowPath: [shadowRoot],
          targetElement: new DOMElement(shadowButton)
        });

        const result = await generateSelector(context);
        
        expect(result).toBeInstanceOf(CSSSelector);
        expect(result.shadowAware).toBe(true);
        expect(result.value).toContain('#shadow-host');
        expect(result.value).toContain('.shadow-btn');
        expect(result.explanation).toContain('shadow DOM');
      } else {
        pending('Shadow DOM not supported');
      }
    });

    it('should prefer stable attributes over fragile ones', async () => {
      const element = document.createElement('input');
      element.setAttribute('data-testid', 'user-email');
      element.setAttribute('aria-label', 'Email address');
      element.className = 'form-input input-234 dynamic-class';
      testContainer.appendChild(element);

      const context = new ShadowContext({
        isInShadowDOM: false,
        hostElement: null,
        shadowPath: [],
        targetElement: new DOMElement(element)
      });

      const result = await generateSelector(context);
      
      expect(result.isStable).toBe(true);
      expect(result.value).toMatch(/\[data-testid="user-email"\]|\[aria-label="Email address"\]/);
      expect(result.explanation).toContain('stable');
    });

    it('should handle nested shadow DOM selectors', async () => {
      const outerHost = document.createElement('div');
      outerHost.id = 'outer-host';
      testContainer.appendChild(outerHost);

      if (outerHost.attachShadow) {
        const outerShadow = outerHost.attachShadow({ mode: 'open' });
        const innerHost = document.createElement('div');
        innerHost.className = 'inner-host';
        outerShadow.appendChild(innerHost);

        const innerShadow = innerHost.attachShadow({ mode: 'open' });
        const deepElement = document.createElement('span');
        deepElement.id = 'deep-element';
        innerShadow.appendChild(deepElement);

        const context = new ShadowContext({
          isInShadowDOM: true,
          hostElement: new DOMElement(outerHost),
          shadowPath: [outerShadow, innerShadow],
          targetElement: new DOMElement(deepElement)
        });

        const result = await generateSelector(context);
        
        expect(result.shadowAware).toBe(true);
        expect(result.value).toContain('#outer-host');
        expect(result.value).toContain('#deep-element');
        expect(result.explanation).toContain('nested shadow');
      } else {
        pending('Shadow DOM not supported');
      }
    });

    it('should return null for invalid context', async () => {
      const result = await generateSelector(null as any);
      expect(result).toBeNull();
    });

    it('should generate fallback selector when no stable attributes exist', async () => {
      const element = document.createElement('div');
      // No ID, no stable attributes, only position-based
      testContainer.appendChild(element);

      const context = new ShadowContext({
        isInShadowDOM: false,
        hostElement: null,
        shadowPath: [],
        targetElement: new DOMElement(element)
      });

      const result = await generateSelector(context);
      
      expect(result).toBeInstanceOf(CSSSelector);
      expect(result.isStable).toBe(false);
      expect(result.explanation).toContain('position-based');
    });
  });
});