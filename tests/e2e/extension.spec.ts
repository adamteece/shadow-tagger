// E2E Test Suite for Shadow Tagger Extension
// Comprehensive testing covering all extension workflows

import { test, expect, chromium, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Test configuration
const EXTENSION_PATH = path.join(__dirname, '../../dist');
const TEST_TIMEOUT = 30000;

test.describe('Shadow Tagger E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionPage: Page;

  test.beforeAll(async () => {
    // Launch browser with extension
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking'
      ]
    });
    
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.describe('Extension Installation and Initialization', () => {
    test('should load extension successfully', async () => {
      // Get extension ID
      const extensionTarget = context.serviceWorkers()[0] || context.backgroundPages()[0];
      expect(extensionTarget).toBeDefined();
      
      // Verify extension is loaded
      const extensions = await context.pages();
      const extensionPages = extensions.filter(p => p.url().startsWith('chrome-extension://'));
      expect(extensionPages.length).toBeGreaterThan(0);
    });

    test('should have correct manifest permissions', async () => {
      const manifest = require('../../src/manifest.json');
      
      expect(manifest.permissions).toContain('activeTab');
      expect(manifest.permissions).toContain('storage');
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toBe('Shadow Tagger');
    });

    test('should initialize extension state', async () => {
      await page.goto('about:blank');
      
      // Check if extension state is initialized
      const state = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['extensionState'], (result) => {
            resolve(result.extensionState);
          });
        });
      });
      
      // State should be initialized even if empty
      expect(state).toBeDefined();
    });
  });

  test.describe('Popup Interface Tests', () => {
    test('should open extension popup', async () => {
      // Get extension URL
      const extensionId = await getExtensionId(context);
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      
      extensionPage = await context.newPage();
      await extensionPage.goto(popupUrl);
      
      // Verify popup loaded
      await expect(extensionPage.locator('.popup-container')).toBeVisible();
      await expect(extensionPage.locator('#extensionToggle')).toBeVisible();
    });

    test('should toggle extension state', async () => {
      const toggle = extensionPage.locator('#extensionToggle');
      
      // Check initial state
      const initialState = await toggle.isChecked();
      
      // Toggle extension
      await toggle.click();
      
      // Verify state changed
      const newState = await toggle.isChecked();
      expect(newState).toBe(!initialState);
    });

    test('should display correct status information', async () => {
      const statusElement = extensionPage.locator('#pageStatus');
      await expect(statusElement).toBeVisible();
      
      const statusText = await statusElement.textContent();
      expect(statusText).toMatch(/Ready|Active|Inactive/);
    });

    test('should handle element picker activation', async () => {
      const pickerButton = extensionPage.locator('#togglePicker');
      
      await pickerButton.click();
      
      // Verify button state changes
      const buttonClass = await pickerButton.getAttribute('class');
      expect(buttonClass).toContain('active');
    });
  });

  test.describe('Content Script Integration', () => {
    test('should inject content script into web pages', async () => {
      await page.goto('https://example.com');
      
      // Check if content script is injected
      const isInjected = await page.evaluate(() => {
        return typeof window.shadowTagger !== 'undefined';
      });
      
      expect(isInjected).toBe(true);
    });

    test('should enable element picker mode', async () => {
      await page.goto('https://example.com');
      
      // Activate element picker through messaging
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      // Verify picker overlay is added
      const overlay = await page.locator('[data-shadow-tagger="overlay"]');
      await expect(overlay).toBeAttached();
    });

    test('should highlight elements on hover', async () => {
      await page.goto('https://example.com');
      
      // Activate picker
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      // Hover over an element
      const targetElement = page.locator('h1').first();
      await targetElement.hover();
      
      // Check if overlay is positioned correctly
      const overlay = page.locator('[data-shadow-tagger="overlay"]');
      await expect(overlay).toBeVisible();
    });

    test('should analyze clicked elements', async () => {
      await page.goto('https://example.com');
      
      // Activate picker and click element
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      const targetElement = page.locator('h1').first();
      await targetElement.click();
      
      // Verify analysis results are generated
      const results = await page.evaluate(() => {
        return window.shadowTaggerResults;
      });
      
      expect(results).toBeDefined();
      expect(results.tagName).toBe('H1');
    });
  });

  test.describe('Shadow DOM Detection', () => {
    test('should detect elements within shadow DOM', async () => {
      // Create test page with shadow DOM
      await page.setContent(`
        <html>
          <body>
            <div id="shadow-host"></div>
            <script>
              const host = document.getElementById('shadow-host');
              const shadow = host.attachShadow({mode: 'open'});
              shadow.innerHTML = '<button id="shadow-button">Shadow Button</button>';
            </script>
          </body>
        </html>
      `);
      
      // Activate picker
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      // Click on shadow DOM element
      const shadowButton = page.locator('#shadow-host').locator('button');
      await shadowButton.click();
      
      // Verify shadow DOM detection
      const results = await page.evaluate(() => {
        return window.shadowTaggerResults;
      });
      
      expect(results.shadowInfo.isInShadowDOM).toBe(true);
      expect(results.shadowInfo.hostElement).toContain('#shadow-host');
    });

    test('should handle nested shadow DOM', async () => {
      // Create nested shadow DOM structure
      await page.setContent(`
        <html>
          <body>
            <div id="outer-host"></div>
            <script>
              const outerHost = document.getElementById('outer-host');
              const outerShadow = outerHost.attachShadow({mode: 'open'});
              outerShadow.innerHTML = '<div id="inner-host"></div>';
              
              const innerHost = outerShadow.getElementById('inner-host');
              const innerShadow = innerHost.attachShadow({mode: 'open'});
              innerShadow.innerHTML = '<span id="deep-element">Deep Content</span>';
            </script>
          </body>
        </html>
      `);
      
      // Test nested shadow DOM detection
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      const deepElement = page.locator('#outer-host').locator('#inner-host').locator('span');
      await deepElement.click();
      
      const results = await page.evaluate(() => {
        return window.shadowTaggerResults;
      });
      
      expect(results.shadowInfo.shadowDepth).toBe(2);
    });
  });

  test.describe('Messaging System', () => {
    test('should handle background-content messaging', async () => {
      await page.goto('https://example.com');
      
      // Send message from content to background
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'ANALYZE_ELEMENT',
            data: { tagName: 'DIV', id: 'test' }
          }, resolve);
        });
      });
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    test('should handle popup-background messaging', async () => {
      const extensionId = await getExtensionId(context);
      extensionPage = await context.newPage();
      await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Send message from popup to background
      const response = await extensionPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'GET_EXTENSION_STATE'
          }, resolve);
        });
      });
      
      expect(response).toBeDefined();
      expect(response.state).toBeDefined();
    });

    test('should validate message types', async () => {
      await page.goto('https://example.com');
      
      // Send invalid message type
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'INVALID_MESSAGE_TYPE'
          }, resolve);
        });
      });
      
      expect(response.error).toBeDefined();
    });
  });

  test.describe('Clipboard Operations', () => {
    test('should copy element data to clipboard', async () => {
      await page.goto('https://example.com');
      
      // Analyze an element
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      const targetElement = page.locator('h1').first();
      await targetElement.click();
      
      // Trigger clipboard copy
      await page.keyboard.press('Control+C');
      
      // Verify clipboard content (note: actual clipboard access may be limited in tests)
      const clipboardIndicator = page.locator('[data-shadow-tagger="notification"]');
      await expect(clipboardIndicator).toBeVisible({ timeout: 2000 });
    });

    test('should handle different export formats', async () => {
      const extensionId = await getExtensionId(context);
      extensionPage = await context.newPage();
      await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Test format switching
      const formatSelect = extensionPage.locator('#exportFormat');
      await formatSelect.selectOption('json');
      
      const selectedValue = await formatSelect.inputValue();
      expect(selectedValue).toBe('json');
    });
  });

  test.describe('URL Pattern Analysis', () => {
    test('should analyze URL patterns', async () => {
      await page.goto('https://example.com/users/123/profile');
      
      // Trigger URL analysis
      const analysis = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'ANALYZE_URL',
            url: window.location.href
          }, resolve);
        });
      });
      
      expect(analysis.volatileSegments).toBeDefined();
      expect(analysis.originalURL).toBe('https://example.com/users/123/profile');
    });

    test('should detect dynamic URL segments', async () => {
      await page.goto('https://example.com/products/abc123/details');
      
      const analysis = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'ANALYZE_URL',
            url: window.location.href
          }, resolve);
        });
      });
      
      expect(analysis.volatileSegments.length).toBeGreaterThan(0);
      expect(analysis.volatileSegments[0].type).toMatch(/alphanumeric-id|product-id/);
    });
  });

  test.describe('Pendo Integration', () => {
    test('should generate Pendo-compatible selectors', async () => {
      await page.goto('https://example.com');
      
      // Create element with data attributes
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.setAttribute('data-pendo', 'test-component');
        div.setAttribute('data-testid', 'user-button');
        div.id = 'user-actions';
        document.body.appendChild(div);
      });
      
      // Analyze the element
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      const testElement = page.locator('[data-pendo="test-component"]');
      await testElement.click();
      
      const results = await page.evaluate(() => {
        return window.shadowTaggerResults;
      });
      
      expect(results.pendoSelector).toBeDefined();
      expect(results.pendoSelector).toContain('data-pendo');
    });

    test('should format results for Pendo', async () => {
      await page.goto('https://example.com');
      
      const pendoFormat = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'FORMAT_FOR_PENDO',
            data: {
              tagName: 'button',
              attributes: { 'data-testid': 'submit-btn' }
            }
          }, resolve);
        });
      });
      
      expect(pendoFormat.selector).toContain('[data-testid="submit-btn"]');
      expect(pendoFormat.rule).toBeDefined();
    });
  });

  test.describe('State Management', () => {
    test('should persist extension state', async () => {
      const extensionId = await getExtensionId(context);
      extensionPage = await context.newPage();
      await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Change a setting
      const toggle = extensionPage.locator('#extensionToggle');
      await toggle.click();
      
      // Close and reopen popup
      await extensionPage.close();
      extensionPage = await context.newPage();
      await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Verify state persisted
      const newToggle = extensionPage.locator('#extensionToggle');
      const isChecked = await newToggle.isChecked();
      expect(isChecked).toBe(true);
    });

    test('should track analysis sessions', async () => {
      await page.goto('https://example.com');
      
      // Perform multiple analyses
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.postMessage({
            type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
            source: 'shadow-tagger-extension'
          }, '*');
        });
        
        const element = page.locator('div').first();
        await element.click();
      }
      
      // Check session data
      const sessionData = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'GET_SESSION_DATA'
          }, resolve);
        });
      });
      
      expect(sessionData.analysisCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle malformed messages gracefully', async () => {
      await page.goto('https://example.com');
      
      // Send malformed message
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            invalidStructure: true
          }, resolve);
        });
      });
      
      expect(response.error).toBeDefined();
    });

    test('should recover from picker failures', async () => {
      await page.goto('about:blank');
      
      // Try to activate picker on blank page
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      // Should not crash the extension
      const isResponsive = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'PING'
          }, resolve);
        });
      });
      
      expect(isResponsive.pong).toBe(true);
    });
  });

  test.describe('Performance Tests', () => {
    test('should handle large DOM trees efficiently', async () => {
      // Create large DOM structure
      await page.setContent(`
        <html>
          <body>
            <div id="large-container"></div>
            <script>
              const container = document.getElementById('large-container');
              for (let i = 0; i < 1000; i++) {
                const div = document.createElement('div');
                div.className = 'item-' + i;
                div.textContent = 'Item ' + i;
                container.appendChild(div);
              }
            </script>
          </body>
        </html>
      `);
      
      // Measure analysis time
      const startTime = Date.now();
      
      await page.evaluate(() => {
        window.postMessage({
          type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
          source: 'shadow-tagger-extension'
        }, '*');
      });
      
      const randomItem = page.locator('.item-500');
      await randomItem.click();
      
      const endTime = Date.now();
      const analysisTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(analysisTime).toBeLessThan(5000);
    });

    test('should limit memory usage', async () => {
      await page.goto('https://example.com');
      
      // Perform many analyses
      for (let i = 0; i < 50; i++) {
        await page.evaluate(() => {
          window.postMessage({
            type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
            source: 'shadow-tagger-extension'
          }, '*');
        });
        
        const element = page.locator('div').nth(i % 5);
        await element.click();
      }
      
      // Memory should not grow unbounded
      const memoryUsage = await page.evaluate(() => {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });
      
      // Should stay under reasonable limits (50MB)
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work with different browser features', async () => {
      await page.goto('https://example.com');
      
      // Test feature detection
      const features = await page.evaluate(() => {
        return {
          shadowDOM: typeof Element.prototype.attachShadow === 'function',
          customElements: typeof customElements !== 'undefined',
          clipboard: typeof navigator.clipboard !== 'undefined'
        };
      });
      
      // Extension should adapt to available features
      expect(features.shadowDOM).toBe(true);
      
      const analysis = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'CHECK_BROWSER_SUPPORT'
          }, resolve);
        });
      });
      
      expect(analysis.supported).toBe(true);
    });
  });
});

// Utility functions
async function getExtensionId(context: BrowserContext): Promise<string> {
  const extensionTarget = context.serviceWorkers()[0] || context.backgroundPages()[0];
  const extensionURL = extensionTarget.url();
  const matches = extensionURL.match(/chrome-extension:\/\/([a-z]+)/);
  return matches ? matches[1] : '';
}

// Test data and fixtures
export const testFixtures = {
  shadowDOMHTML: `
    <div id="shadow-host">
      <template shadowroot="open">
        <style>
          .shadow-content { color: blue; }
        </style>
        <div class="shadow-content">
          <button id="shadow-button">Click me</button>
        </div>
      </template>
    </div>
  `,
  
  complexFormHTML: `
    <form id="test-form" data-testid="user-form">
      <input type="text" id="username" name="username" data-pendo="username-field" />
      <input type="email" id="email" name="email" aria-label="Email address" />
      <button type="submit" data-testid="submit-btn">Submit</button>
    </form>
  `,
  
  dynamicContentHTML: `
    <div id="dynamic-container">
      <div class="item" data-id="123">Item 1</div>
      <div class="item" data-id="456">Item 2</div>
      <div class="item" data-id="789">Item 3</div>
    </div>
  `
};

// Performance benchmarks
export const performanceBenchmarks = {
  maxAnalysisTime: 1000, // ms
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  maxDOMTraversalTime: 500 // ms
};