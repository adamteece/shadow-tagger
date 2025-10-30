// T032: Attribute picker UI for interactive selector customization
// Allows users to select which attributes to include in generated selectors

import { getAvailableAttributes, generateWithAttributes } from '../lib/shadow-dom-detector/SelectorGenerator';
import { ShadowContext } from '../lib/shadow-dom-detector/models/ShadowContext';

export interface AttributeSelection {
  name: string;
  value: string;
  selected: boolean;
  category: 'stable' | 'semantic' | 'styling' | 'other';
  recommended: boolean;
}

export class AttributePicker {
  private container: HTMLElement | null = null;
  private targetElement: HTMLElement | null = null;
  private attributes: AttributeSelection[] = [];
  private onSelectionChange?: (selectedAttributes: string[], selector: string) => void;
  private shadowContext: ShadowContext | null = null;

  constructor() {
    this.createUI();
  }

  /**
   * Show attribute picker for an element
   */
  async show(element: HTMLElement, context: ShadowContext, onChange?: (selectedAttributes: string[], selector: string) => void): Promise<void> {
    this.targetElement = element;
    this.shadowContext = context;
    this.onSelectionChange = onChange;

    // Get available attributes
    const availableAttrs = getAvailableAttributes(element);
    this.attributes = availableAttrs.map(attr => ({
      ...attr,
      selected: attr.recommended // Auto-select recommended attributes
    }));

    this.renderAttributes();
    this.positionPicker(element);
    this.container!.style.display = 'block';

    // Generate initial selector with recommended attributes
    await this.updateSelector();
  }

  /**
   * Hide the attribute picker
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.targetElement = null;
    this.shadowContext = null;
    this.attributes = [];
  }

  /**
   * Check if picker is currently visible
   */
  isVisible(): boolean {
    return this.container?.style.display === 'block';
  }

  /**
   * Get currently selected attributes
   */
  getSelectedAttributes(): string[] {
    return this.attributes
      .filter(attr => attr.selected)
      .map(attr => attr.name);
  }

  /**
   * Create the UI elements
   */
  private createUI(): void {
    this.container = document.createElement('div');
    this.container.id = 'shadow-tagger-attribute-picker';
    this.container.style.cssText = `
      position: absolute;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      padding: 16px;
      z-index: 10003;
      display: none;
      min-width: 320px;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #333;
    `;

    document.body.appendChild(this.container);
  }

  /**
   * Render the attribute list
   */
  private renderAttributes(): void {
    if (!this.container) return;

    const categoryOrder: ('stable' | 'semantic' | 'styling' | 'other')[] = ['stable', 'semantic', 'styling', 'other'];
    const categoryLabels = {
      stable: '🔒 Stable Identifiers',
      semantic: '🏷️ Semantic Attributes',
      styling: '🎨 Styling',
      other: '📋 Other'
    };

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Select Attributes</h3>
        <button id="attr-picker-close" style="
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          color: #999;
        ">&times;</button>
      </div>
      <div style="margin-bottom: 12px; padding: 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; color: #666;">
        Select attributes to include in the selector. Recommended attributes are pre-selected.
      </div>
      <div style="max-height: 300px; overflow-y: auto;">
    `;

    // Group attributes by category
    for (const category of categoryOrder) {
      const categoryAttrs = this.attributes.filter(attr => attr.category === category);
      if (categoryAttrs.length === 0) continue;

      html += `
        <div style="margin-bottom: 16px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: #555; font-size: 13px;">
            ${categoryLabels[category]}
          </div>
      `;

      for (const attr of categoryAttrs) {
        const truncatedValue = attr.value.length > 40 
          ? attr.value.substring(0, 40) + '...' 
          : attr.value;

        html += `
          <label style="
            display: flex;
            align-items: start;
            padding: 6px 8px;
            margin-bottom: 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.15s;
          " onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
            <input 
              type="checkbox" 
              class="attr-checkbox" 
              data-attr-name="${attr.name}"
              ${attr.selected ? 'checked' : ''}
              style="margin-right: 8px; margin-top: 2px; cursor: pointer;"
            />
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; color: #333;">
                ${attr.name}
                ${attr.recommended ? '<span style="color: #28a745; font-size: 11px; margin-left: 4px;">✓ Recommended</span>' : ''}
              </div>
              <div style="font-size: 11px; color: #666; word-break: break-word; margin-top: 2px;">
                ${this.escapeHtml(truncatedValue)}
              </div>
            </div>
          </label>
        `;
      }

      html += `</div>`;
    }

    html += `
      </div>
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Generated Selector:</div>
        <div id="attr-picker-selector" style="
          padding: 8px;
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 12px;
          word-break: break-all;
          max-height: 100px;
          overflow-y: auto;
        ">Generating...</div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button id="attr-picker-copy" style="
          padding: 8px 16px;
          background: #34a853;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        " onmouseover="this.style.background='#2d9348'" onmouseout="this.style.background='#34a853'" title="Copy selector to clipboard">
          📋 Copy
        </button>
        <button id="attr-picker-apply" style="
          flex: 1;
          padding: 8px 16px;
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        " onmouseover="this.style.background='#357ae8'" onmouseout="this.style.background='#4285f4'">
          Apply Selector
        </button>
        <button id="attr-picker-cancel" style="
          padding: 8px 16px;
          background: #f1f3f4;
          color: #333;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        " onmouseover="this.style.background='#e8eaed'" onmouseout="this.style.background='#f1f3f4'">
          Cancel
        </button>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Attach event listeners to UI elements
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Checkbox changes
    const checkboxes = this.container.querySelectorAll('.attr-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const attrName = (e.target as HTMLInputElement).dataset.attrName!;
        const isChecked = (e.target as HTMLInputElement).checked;
        
        const attr = this.attributes.find(a => a.name === attrName);
        if (attr) {
          attr.selected = isChecked;
          this.updateSelector();
        }
      });
    });

    // Close button
    const closeBtn = this.container.querySelector('#attr-picker-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Copy button
    const copyBtn = this.container.querySelector('#attr-picker-copy');
    copyBtn?.addEventListener('click', async () => {
      const selectorDisplay = this.container?.querySelector('#attr-picker-selector')?.textContent || '';
      if (selectorDisplay && selectorDisplay !== 'Generating...' && selectorDisplay !== 'Select at least one attribute') {
        try {
          await navigator.clipboard.writeText(selectorDisplay);
          this.showCopyFeedback(copyBtn as HTMLElement);
        } catch (error) {
          console.error('Failed to copy selector:', error);
          // Fallback to execCommand
          this.copyTextFallback(selectorDisplay);
        }
      }
    });

    // Apply button
    const applyBtn = this.container.querySelector('#attr-picker-apply');
    applyBtn?.addEventListener('click', () => {
      const selectedAttrs = this.getSelectedAttributes();
      const selectorDisplay = this.container?.querySelector('#attr-picker-selector')?.textContent || '';
      
      if (this.onSelectionChange) {
        this.onSelectionChange(selectedAttrs, selectorDisplay);
      }
      
      this.hide();
    });

    // Cancel button
    const cancelBtn = this.container.querySelector('#attr-picker-cancel');
    cancelBtn?.addEventListener('click', () => this.hide());
  }

  /**
   * Update the generated selector display
   */
  private async updateSelector(): Promise<void> {
    if (!this.container || !this.shadowContext) return;

    const selectorDisplay = this.container.querySelector('#attr-picker-selector');
    if (!selectorDisplay) return;

    const selectedAttrs = this.getSelectedAttributes();

    if (selectedAttrs.length === 0) {
      selectorDisplay.textContent = 'Select at least one attribute';
      selectorDisplay.setAttribute('style', selectorDisplay.getAttribute('style')! + '; color: #dc3545;');
      return;
    }

    try {
      // Generate selector with selected attributes
      const cssSelector = await generateWithAttributes(
        this.shadowContext,
        selectedAttrs,
        { pendoCompatible: true }
      );

      if (cssSelector && cssSelector.value) {
        selectorDisplay.textContent = cssSelector.value;
        selectorDisplay.setAttribute('style', selectorDisplay.getAttribute('style')!.replace('color: #dc3545;', ''));
        
        // Notify callback
        if (this.onSelectionChange) {
          this.onSelectionChange(selectedAttrs, cssSelector.value);
        }
      } else {
        selectorDisplay.textContent = 'Could not generate selector';
        selectorDisplay.setAttribute('style', selectorDisplay.getAttribute('style')! + '; color: #dc3545;');
      }
    } catch (error) {
      console.error('Selector generation error:', error);
      selectorDisplay.textContent = 'Error generating selector';
      selectorDisplay.setAttribute('style', selectorDisplay.getAttribute('style')! + '; color: #dc3545;');
    }
  }

  /**
   * Position the picker near the target element
   */
  private positionPicker(element: HTMLElement): void {
    if (!this.container) return;

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    // Position to the right of the element, or left if not enough space
    let left = rect.right + scrollX + 10;
    let top = rect.top + scrollY;

    // Check if picker would go off right edge
    const pickerWidth = 400; // max-width
    if (left + pickerWidth > window.innerWidth + scrollX) {
      // Position to the left instead
      left = rect.left + scrollX - pickerWidth - 10;
    }

    // Ensure picker doesn't go off left edge
    if (left < scrollX) {
      left = scrollX + 10;
    }

    // Ensure picker doesn't go off bottom
    const pickerHeight = 500; // approximate max height
    if (top + pickerHeight > window.innerHeight + scrollY) {
      top = Math.max(scrollY + 10, window.innerHeight + scrollY - pickerHeight - 10);
    }

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show visual feedback for copy action
   */
  private showCopyFeedback(button: HTMLElement): void {
    const originalHTML = button.innerHTML;
    const originalBg = button.style.background;
    
    button.innerHTML = '✓ Copied!';
    button.style.background = '#1e7e34';
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = originalBg;
    }, 1500);
  }

  /**
   * Fallback copy using execCommand
   */
  private copyTextFallback(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position: fixed; top: -9999px; left: -9999px; opacity: 0;';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      const copyBtn = this.container?.querySelector('#attr-picker-copy') as HTMLElement;
      if (copyBtn) {
        this.showCopyFeedback(copyBtn);
      }
    } catch (error) {
      console.error('Fallback copy failed:', error);
    } finally {
      document.body.removeChild(textarea);
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.targetElement = null;
    this.shadowContext = null;
    this.attributes = [];
  }
}
