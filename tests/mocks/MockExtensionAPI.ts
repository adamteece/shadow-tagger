// Mock Extension API for testing
// Simulates browser extension APIs without requiring actual browser context

export class MockExtensionAPI {
  private storage: Map<string, any> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  public sentMessages: any[] = [];
  public simulateError: boolean = false;
  
  // Mock chrome.storage.local
  get storageLocal() {
    return {
      get: async (keys: string | string[]): Promise<any> => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const result: any = {};
        
        for (const key of keyArray) {
          if (this.storage.has(key)) {
            result[key] = this.storage.get(key);
          }
        }
        
        return result;
      },
      
      set: async (items: { [key: string]: any }): Promise<void> => {
        for (const [key, value] of Object.entries(items)) {
          this.storage.set(key, value);
        }
      },
      
      remove: async (keys: string | string[]): Promise<void> => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        
        for (const key of keyArray) {
          this.storage.delete(key);
        }
      },
      
      clear: async (): Promise<void> => {
        this.storage.clear();
      }
    };
  }
  
  // Mock chrome.runtime
  get runtime() {
    return {
      sendMessage: async (message: any): Promise<any> => {
        if (this.simulateError) {
          throw new Error('Simulated error');
        }
        
        this.sentMessages.push(message);
        const listeners = this.listeners.get('runtime.onMessage') || [];
        
        for (const listener of listeners) {
          const result = await listener(message, {}, () => {});
          if (result !== undefined) {
            return result;
          }
        }
        
        return null;
      },
      
      onMessage: {
        addListener: (callback: Function) => {
          const listeners = this.listeners.get('runtime.onMessage') || [];
          listeners.push(callback);
          this.listeners.set('runtime.onMessage', listeners);
        },
        
        removeListener: (callback: Function) => {
          const listeners = this.listeners.get('runtime.onMessage') || [];
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      },
      
      getManifest: () => ({
        name: 'Shadow Tagger Test',
        version: '1.0.0',
        manifest_version: 3
      })
    };
  }
  
  // Mock chrome.tabs
  get tabs() {
    return {
      query: async (queryInfo: any): Promise<any[]> => {
        return [
          { id: 1, url: 'https://example.com', active: true }
        ];
      },
      
      sendMessage: async (tabId: number, message: any): Promise<any> => {
        return this.runtime.sendMessage(message);
      },
      
      create: async (createProperties: any): Promise<any> => {
        return {
          id: Math.floor(Math.random() * 1000),
          url: createProperties.url
        };
      }
    };
  }
  
  // Helper to trigger message listeners
  triggerMessage(message: any, sender: any = {}): Promise<any> {
    return this.runtime.sendMessage(message);
  }
  
  // Helper to get storage state
  getStorageState(): { [key: string]: any } {
    const state: any = {};
    this.storage.forEach((value, key) => {
      state[key] = value;
    });
    return state;
  }
  
  // Helper to reset mock state
  reset(): void {
    this.storage.clear();
    this.listeners.clear();
    this.sentMessages = [];
    this.simulateError = false;
  }
}
