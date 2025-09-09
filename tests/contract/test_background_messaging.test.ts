// T013: Contract test background-content communication
// This test MUST FAIL until messaging system is implemented

import { sendToBackground, sendToContent } from '../../src/messaging/MessageBus';
import { BackgroundMessage, ContentMessage, MessageResponse } from '../../src/messaging/types';

describe('Background-Content Messaging Contract', () => {
  describe('sendToBackground()', () => {
    it('should send state persistence requests to background', async () => {
      const message: BackgroundMessage = {
        type: 'PERSIST_STATE',
        payload: {
          lastAnalysis: {
            elementSelector: '#test-button',
            urlPattern: 'https://example.com/*'
          }
        }
      };

      const response = await sendToBackground(message);
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.type).toBe('STATE_PERSISTED');
    });

    it('should retrieve stored state from background', async () => {
      const message: BackgroundMessage = {
        type: 'GET_STORED_STATE',
        payload: {}
      };

      const response = await sendToBackground(message);
      
      expect(response.type).toBe('STORED_STATE_RESULT');
      expect(response.payload.state).toBeDefined();
    });

    it('should handle clipboard copy requests', async () => {
      const message: BackgroundMessage = {
        type: 'COPY_TO_CLIPBOARD',
        payload: {
          text: '#submit-button',
          format: 'css-selector'
        }
      };

      const response = await sendToBackground(message);
      
      expect(response.success).toBe(true);
      expect(response.type).toBe('CLIPBOARD_COPIED');
    });

    it('should handle background messaging errors', async () => {
      const message: BackgroundMessage = {
        type: 'INVALID_MESSAGE_TYPE' as any,
        payload: {}
      };

      const response = await sendToBackground(message);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('sendToContent()', () => {
    it('should send element highlighting requests to content script', async () => {
      const message: ContentMessage = {
        type: 'HIGHLIGHT_ELEMENT',
        payload: {
          selector: '.test-element',
          duration: 3000
        }
      };

      const response = await sendToContent(message);
      
      expect(response.success).toBe(true);
      expect(response.type).toBe('ELEMENT_HIGHLIGHTED');
    });

    it('should send DOM injection requests to content script', async () => {
      const message: ContentMessage = {
        type: 'INJECT_OVERLAY',
        payload: {
          overlayType: 'element-picker',
          enabled: true
        }
      };

      const response = await sendToContent(message);
      
      expect(response.success).toBe(true);
      expect(response.type).toBe('OVERLAY_INJECTED');
    });

    it('should handle element picker activation', async () => {
      const message: ContentMessage = {
        type: 'ACTIVATE_PICKER',
        payload: {
          mode: 'shadow-aware'
        }
      };

      const response = await sendToContent(message);
      
      expect(response.success).toBe(true);
      expect(response.type).toBe('PICKER_ACTIVATED');
      expect(response.payload.pickerMode).toBe('shadow-aware');
    });

    it('should handle content script messaging errors', async () => {
      const message: ContentMessage = {
        type: 'INVALID_CONTENT_MESSAGE' as any,
        payload: {}
      };

      const response = await sendToContent(message);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Cross-tab communication', () => {
    it('should support broadcasting state changes across tabs', async () => {
      const message: BackgroundMessage = {
        type: 'BROADCAST_STATE_CHANGE',
        payload: {
          stateChange: {
            type: 'FEATURE_TOGGLED',
            feature: 'shadow-dom-detection',
            enabled: true
          }
        }
      };

      const response = await sendToBackground(message);
      
      expect(response.success).toBe(true);
      expect(response.type).toBe('STATE_BROADCASTED');
    });

    it('should handle tab-specific state isolation', async () => {
      const message: BackgroundMessage = {
        type: 'GET_TAB_STATE',
        payload: {
          tabId: 'current'
        }
      };

      const response = await sendToBackground(message);
      
      expect(response.payload.tabState).toBeDefined();
      expect(response.payload.tabState.tabId).toBe('current');
    });
  });
});