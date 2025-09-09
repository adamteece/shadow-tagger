# Shadow Tagger

🎯 **A powerful Chrome extension for DOM element analysis and Pendo selector generation**

Shadow Tagger helps developers and QA professionals identify DOM elements, analyze shadow DOM structures, and generate reliable selectors for automation tools like Pendo.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-brightgreen)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](CHANGELOG.md)

## ✨ Features

- 🔍 **Element Picker**: Click-to-analyze any DOM element
- 🌑 **Shadow DOM Support**: Deep analysis of shadow DOM structures  
- 📋 **Multiple Export Formats**: Copy as text, JSON, CSV, or HTML
- 🎯 **Pendo Integration**: Generate Pendo-compatible selectors
- 🔗 **URL Pattern Analysis**: Detect dynamic URL segments
- 🛡️ **Privacy-First**: All processing happens locally
- ⚡ **Fast & Lightweight**: Minimal performance impact

## 🚀 Quick Start

### Installation

1. **From Chrome Web Store** (Recommended)
   - Visit the [Chrome Web Store](https://chrome.google.com/webstore)
   - Search for "Shadow Tagger"
   - Click "Add to Chrome"

2. **Developer Installation**
   ```bash
   git clone https://github.com/your-org/shadow-tagger.git
   cd shadow-tagger
   npm install
   npm run build
   ```
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Basic Usage

1. **Activate Extension**: Click the Shadow Tagger icon in your browser toolbar
2. **Pick Elements**: Click "Element Picker" and hover over elements
3. **Analyze**: Click any element to see detailed analysis
4. **Copy Results**: Use Ctrl+C or click copy button to export data

## 📖 User Guide

### Interface Overview

The Shadow Tagger popup provides several key sections:

#### Header
- **Extension Toggle**: Enable/disable the extension
- **Status Indicator**: Shows current page compatibility

#### Quick Actions
- **Element Picker**: Activate interactive element selection
- **Analyze Page**: Scan entire page for elements
- **Clear Results**: Remove all analysis data

#### Results Display
- **Element List**: Shows analyzed elements with details
- **URL Patterns**: Displays detected dynamic URL segments
- **Export Options**: Copy data in various formats

### Element Analysis

#### Basic Element Information
When you analyze an element, Shadow Tagger provides:

- **Tag Name**: HTML tag (div, button, span, etc.)
- **ID**: Element ID attribute
- **Classes**: CSS class names
- **Text Content**: Visible text within element
- **Attributes**: All HTML attributes

#### Advanced Analysis

**CSS Selectors**
- Generates stable, unique CSS selectors
- Prioritizes ID and data attributes
- Provides fallback selectors for reliability

**Shadow DOM Detection**
- Identifies elements within shadow DOM
- Shows shadow host element
- Indicates shadow nesting depth

**Pendo Compatibility**
- Generates Pendo-compatible selectors
- Identifies data attributes suitable for tracking
- Provides selector optimization suggestions

### URL Pattern Analysis

Shadow Tagger automatically analyzes URLs to identify:

- **Dynamic Segments**: User IDs, product IDs, timestamps
- **Static Parts**: Consistent URL components
- **Hash Routing**: Single-page application routes
- **Query Parameters**: URL search parameters

#### Pattern Types Detected

- `numeric-id`: Numbers like user IDs (123, 456789)
- `guid`: UUID format (abc123-def456-...)
- `alphanumeric-id`: Mixed format (user123, prod-abc)
- `version`: Version numbers (v1.2.3, 2.0)
- `date`: Date formats (2025-09-09, 20250909)
- `hash-segment`: Hash router paths

### Export Formats

#### Text Format
```
Tag: button
ID: submit-btn
Class: btn btn-primary
Selector: #submit-btn
Text: Submit Form

Attributes:
  data-testid: submit-button
  type: submit
  aria-label: Submit the form
```

#### JSON Format
```json
{
  "tagName": "button",
  "id": "submit-btn",
  "className": "btn btn-primary",
  "selector": "#submit-btn",
  "textContent": "Submit Form",
  "attributes": {
    "data-testid": "submit-button",
    "type": "submit",
    "aria-label": "Submit the form"
  }
}
```

#### CSV Format
```csv
TagName,ID,ClassName,Selector,TextContent
button,submit-btn,"btn btn-primary",#submit-btn,Submit Form
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Toggle element picker |
| `Ctrl+C` | Copy current analysis |
| `Escape` | Deactivate picker |
| `Ctrl+Shift+A` | Analyze entire page |
| `Ctrl+Shift+R` | Clear all results |

## 🔧 Advanced Features

### Shadow DOM Analysis

Shadow Tagger excels at analyzing complex shadow DOM structures:

```html
<my-component>
  #shadow-root
    <div class="internal">
      <button id="shadow-btn">Click me</button>
    </div>
</my-component>
```

The extension will:
- Detect the shadow boundary
- Generate selectors that traverse shadow DOM
- Identify the host element
- Show shadow nesting depth

### Custom Element Support

Works seamlessly with custom elements and web components:
- Analyzes custom element tag names
- Detects component-specific attributes
- Identifies slotted content
- Tracks component lifecycle states

### Pendo Integration

#### Selector Generation
Automatically generates Pendo-compatible selectors:

```javascript
// Generated Pendo selector
{
  "selector": "[data-pendo='user-profile'] .edit-button",
  "rule": {
    "name": "Edit Profile Button",
    "selector": "[data-pendo='user-profile'] .edit-button",
    "stable": true
  }
}
```

#### Best Practices
The extension suggests improvements:
- Add `data-testid` attributes
- Use stable class names
- Avoid position-based selectors
- Implement proper ARIA labels

## 🛠️ Troubleshooting

### Common Issues

#### Extension Not Working
**Problem**: Extension icon is grayed out
**Solution**: 
- Check if you're on a supported page (not chrome:// or extension pages)
- Refresh the page
- Check extension permissions in Chrome settings

#### Element Picker Not Activating
**Problem**: Can't select elements
**Solution**:
- Ensure extension is enabled on current tab
- Check for conflicting extensions
- Try refreshing the page
- Verify site allows extension content scripts

#### Shadow DOM Elements Not Detected
**Problem**: Elements in shadow DOM not analyzed
**Solution**:
- Ensure shadow DOM is "open" mode
- Check browser support for shadow DOM
- Try clicking directly on shadow content

#### Clipboard Copy Failing
**Problem**: Can't copy analysis results
**Solution**:
- Grant clipboard permissions when prompted
- Try manual copy with Ctrl+C
- Check browser security settings
- Ensure page is served over HTTPS

### Performance Issues

#### Slow Analysis on Large Pages
**Problem**: Extension becomes slow on complex pages
**Solution**:
- Use element picker instead of full page analysis
- Clear previous results regularly
- Disable other extensions temporarily
- Update to latest Chrome version

#### High Memory Usage
**Problem**: Browser memory usage increases
**Solution**:
- Clear extension data regularly
- Restart browser periodically
- Limit number of analyzed elements
- Report issue if persistent

### Browser Compatibility

| Feature | Chrome | Edge | Opera |
|---------|--------|------|-------|
| Basic Analysis | ✅ | ✅ | ✅ |
| Shadow DOM | ✅ | ✅ | ✅ |
| Clipboard API | ✅ | ✅ | ✅ |
| Web Components | ✅ | ✅ | ✅ |

**Minimum Requirements**:
- Chrome 88+ (Manifest V3 support)
- Enabled JavaScript
- Extensions allowed in browser settings

## 🔐 Privacy & Security

### Data Collection
Shadow Tagger is designed with privacy in mind:

- ✅ **No personal data collection**
- ✅ **Local processing only**
- ✅ **No external network requests**
- ✅ **No browsing history tracking**
- ✅ **No form data capture**

### Permissions Explained

| Permission | Purpose | Required |
|------------|---------|----------|
| `activeTab` | Analyze elements on current tab | Yes |
| `storage` | Save user preferences | Yes |
| `clipboardWrite` | Copy analysis results | Optional |

### Security Features

- **Minimal Permissions**: Only requests necessary access
- **Content Security Policy**: Prevents code injection
- **Input Validation**: All data properly sanitized
- **No eval()**: No dynamic code execution

For detailed privacy information, see our [Privacy Policy](docs/PRIVACY_POLICY.md).

## 🧪 For Developers

### Building from Source

```bash
# Clone repository
git clone https://github.com/your-org/shadow-tagger.git
cd shadow-tagger

# Install dependencies
npm install

# Development build
npm run build:dev

# Production build
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

### Project Structure

```
shadow-tagger/
├── src/
│   ├── background/       # Service worker
│   ├── content/          # Content scripts
│   ├── popup/            # Extension popup
│   ├── lib/              # Core libraries
│   └── utils/            # Utilities
├── tests/                # Test suites
├── docs/                 # Documentation
└── dist/                 # Built extension
```

### API Reference

#### Content Script API

```javascript
// Activate element picker
window.postMessage({
  type: 'SHADOW_TAGGER_ACTIVATE_PICKER',
  source: 'shadow-tagger-extension'
}, '*');

// Get analysis results
const results = window.shadowTaggerResults;
```

#### Extension Messaging

```javascript
// Analyze element
chrome.runtime.sendMessage({
  type: 'ANALYZE_ELEMENT',
  data: { tagName: 'div', id: 'example' }
});

// Get extension state
chrome.runtime.sendMessage({
  type: 'GET_EXTENSION_STATE'
});
```

### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/shadow-tagger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/shadow-tagger/discussions)
- **Email**: support@shadowtagger.dev

## 🙏 Acknowledgments

- Chrome Extension team for Manifest V3
- Web Components community
- Pendo for inspiration on element tracking
- Open source contributors

---

**Made with ❤️ for developers and QA professionals**