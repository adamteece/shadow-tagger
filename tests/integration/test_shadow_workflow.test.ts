// T014: Integration test shadow DOM element detection workflow
// This test MUST FAIL until complete shadow DOM workflow is implemented

import { ShadowDOMWorkflow } from '../../src/workflows/ShadowDOMWorkflow';

describe('Shadow DOM Detection Workflow Integration', () => {
  let workflow: ShadowDOMWorkflow;
  let testContainer: HTMLElement;

  beforeEach(() => {
    workflow = new ShadowDOMWorkflow();
    testContainer = document.createElement('div');
    testContainer.id = 'shadow-workflow-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('Complete shadow DOM detection workflow', () => {
    it('should detect, analyze, and format shadow DOM element end-to-end', async () => {
      // Setup: Create shadow DOM structure
      const host = document.createElement('div');
      host.id = 'test-host';
      host.setAttribute('data-component', 'user-profile');
      testContainer.appendChild(host);

      if (!host.attachShadow) {
        pending('Shadow DOM not supported in test environment');
        return;
      }

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const shadowForm = document.createElement('form');
      shadowForm.className = 'profile-form';
      shadowRoot.appendChild(shadowForm);
      
      const shadowButton = document.createElement('button');
      shadowButton.type = 'submit';
      shadowButton.textContent = 'Save Profile';
      shadowButton.setAttribute('data-testid', 'save-profile-btn');
      shadowForm.appendChild(shadowButton);

      // Execute: Run complete workflow
      const result = await workflow.analyzeElement(shadowButton);
      
      // Verify: Complete analysis result
      expect(result).toBeDefined();
      expect(result.shadowContext.isInShadowDOM).toBe(true);
      expect(result.shadowContext.hostElement.element).toBe(host);
      expect(result.cssSelector.shadowAware).toBe(true);
      expect(result.cssSelector.value).toContain('#test-host');
      expect(result.cssSelector.value).toContain('[data-testid="save-profile-btn"]');
      expect(result.pendoRule.shadowDOMCompatible).toBe(true);
      expect(result.pendoRule.copyableRule).toBeDefined();
      expect(result.preview.matchCount).toBe(1);
    });

    it('should handle nested shadow DOM structures', async () => {
      // Setup: Create nested shadow DOM
      const outerHost = document.createElement('div');
      outerHost.id = 'outer-component';
      testContainer.appendChild(outerHost);

      if (!outerHost.attachShadow) {
        pending('Shadow DOM not supported');
        return;
      }

      const outerShadow = outerHost.attachShadow({ mode: 'open' });
      const innerHost = document.createElement('div');
      innerHost.className = 'inner-component';
      innerHost.setAttribute('data-component-id', 'inner-123');
      outerShadow.appendChild(innerHost);

      const innerShadow = innerHost.attachShadow({ mode: 'open' });
      const deepButton = document.createElement('button');
      deepButton.id = 'deep-action-btn';
      innerShadow.appendChild(deepButton);

      // Execute: Analyze nested element
      const result = await workflow.analyzeElement(deepButton);
      
      // Verify: Nested shadow DOM handling
      expect(result.shadowContext.shadowPath).toHaveLength(2);
      expect(result.cssSelector.value).toContain('#outer-component');
      expect(result.cssSelector.value).toContain('#deep-action-btn');
      expect(result.pendoRule.explanation).toContain('nested shadow');
    });

    it('should provide proper Pendo-compatible selectors', async () => {
      const host = document.createElement('div');
      host.setAttribute('data-pendo-component', 'navigation');
      testContainer.appendChild(host);

      if (!host.attachShadow) {
        pending('Shadow DOM not supported');
        return;
      }

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const navLink = document.createElement('a');
      navLink.href = '/dashboard';
      navLink.setAttribute('aria-label', 'Go to dashboard');
      navLink.textContent = 'Dashboard';
      shadowRoot.appendChild(navLink);

      const result = await workflow.analyzeElement(navLink);
      
      // Verify: Pendo compatibility
      expect(result.pendoRule.isStandard).toBe(true);
      expect(result.pendoRule.copyableRule).not.toContain('/deep/');
      expect(result.pendoRule.copyableRule).not.toContain('::shadow');
      expect(result.pendoRule.explanation).toContain('standard CSS selector');
      expect(result.pendoRule.copyInstructions).toContain('Pendo');
    });

    it('should handle shadow DOM picker interaction', async () => {
      const host = document.createElement('div');
      host.id = 'picker-test-host';
      testContainer.appendChild(host);

      if (!host.attachShadow) {
        pending('Shadow DOM not supported');
        return;
      }

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const targetDiv = document.createElement('div');
      targetDiv.className = 'picker-target';
      shadowRoot.appendChild(targetDiv);

      // Execute: Simulate picker workflow
      await workflow.activatePicker();
      const pickerResult = await workflow.handleElementHover(targetDiv);
      const finalResult = await workflow.handleElementClick(targetDiv);
      
      // Verify: Picker integration
      expect(pickerResult.highlightApplied).toBe(true);
      expect(finalResult.elementSelected).toBe(true);
      expect(finalResult.analysisResult.shadowContext.isInShadowDOM).toBe(true);
    });

    it('should handle closed shadow DOM gracefully', async () => {
      const host = document.createElement('div');
      host.id = 'closed-shadow-host';
      testContainer.appendChild(host);

      if (!host.attachShadow) {
        pending('Shadow DOM not supported');
        return;
      }

      const closedShadow = host.attachShadow({ mode: 'closed' });
      const hiddenElement = document.createElement('span');
      hiddenElement.textContent = 'Hidden content';
      closedShadow.appendChild(hiddenElement);

      const result = await workflow.analyzeElement(hiddenElement);
      
      // Verify: Closed shadow DOM handling
      expect(result.shadowContext.isInShadowDOM).toBe(true);
      expect(result.pendoRule.warnings).toContain('closed shadow DOM');
      expect(result.cssSelector.explanation).toContain('limited access');
    });
  });

  describe('Workflow error handling', () => {
    it('should handle invalid elements gracefully', async () => {
      const result = await workflow.analyzeElement(null as any);
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Invalid element');
    });

    it('should handle DOM manipulation during analysis', async () => {
      const element = document.createElement('button');
      testContainer.appendChild(element);
      
      // Start analysis then remove element
      const analysisPromise = workflow.analyzeElement(element);
      testContainer.removeChild(element);
      
      const result = await analysisPromise;
      
      expect(result.warnings).toContain('Element was removed');
    });
  });
});