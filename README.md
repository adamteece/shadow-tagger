# Shadow Tagger Extension

![Shadow Tagger Icon](public/assets/icon48.png)

A powerful Chrome extension designed for Product Operations and Analytics teams to tag features and pages in modern web applications without engineering support.

## 🚀 Overview

The Shadow Tagger Extension solves two major challenges in product analytics:
1. **Shadow DOM Opacity**: Pierces through Web Components and Shadow DOM to generate Pendo-compliant `::shadow` selectors.
2. **URL Entropy**: Normalizes dynamic URLs (containing UUIDs, session IDs, etc.) into stable Pendo wildcard rules.

## ✨ Key Features

### Feature Tagging (Shadow DOM Inspector)
- **Real-time DOM Inspection**: Highlight elements and traverse Open Shadow DOM roots.
- **Pendo-Compliant Selectors**: Automatically generates `element::shadow` syntax for nested components.
- **Smart Selector Priority**: Heuristically scores identifiers to prefer stable attributes like `data-testid` or `data-pendo-id` over dynamic CSS classes.

### Page Tagging (URL Normalizer)
- **Dynamic Segment Detection**: Automatically identifies UUIDs, MongoDB ObjectIds, and numeric IDs.
- **Segment-by-Segment Control**: Interactively toggle between literal values, single-segment wildcards (`*`), or ignore-after wildcards (`**`).
- **Query Parameter Management**: Easily include, wildcard, or exclude specific query parameters.
- **Pendo Syntax Validation**: Ensures all generated rules adhere to Pendo's official URL syntax.

## 🚀 Quick Install (Recommended)

To get started immediately without installing developer tools:
1. **[Download the latest release zip](https://github.com/adamteece/shadow-tagger/releases/latest)** (`shadow-tagger-extension.zip`).
2. Unzip the file to a location on your computer.
3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (top right).
   - Click **Load unpacked** and select the folder you just unzipped.

## 🛠 Developer Setup

If you want to contribute to the code or build it yourself:

1. Clone this repository:
   ```bash
   git clone https://github.com/adamteece/shadow-tagger.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (top right).
   - Click **Load unpacked** and select the `dist` folder.

## 📖 Usage

### Feature Tagging
1. Open the Shadow Tagger popup.
2. Toggle the **Inspector** on.
3. Hover over elements on your page to see their generated Pendo selector.
4. Click to lock the selection and copy the selector to your clipboard.

### Page Tagging
1. Navigate to the **Page Tagging** tab in the extension.
2. The current URL will be automatically parsed into editable segments.
3. Use the segment chips to build your wildcard rule.
4. Copy the resulting Pendo URL rule for use in your analytics setup.

## 🛡 Security & Privacy
- **Local-first**: All processing runs client-side. No DOM data or URLs are transmitted externally.
- **PII Sanitization**: Selectors containing sensitive patterns (like emails) are automatically rejected.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License
This project is licensed under the ISC License - see the `package.json` file for details.

---
*Developed by Adam Teece*
