# **Product Requirements Document: Shadow Tagger Extension**

# **1\. Overview**

The Shadow Tagger Extension is a Chrome browser utility that enables Product Operations teams to tag features and pages in modern web applications without engineering support. It solves two specific problems:

1. **Shadow DOM Opacity:** Standard analytics tools cannot detect user interactions inside Web Components. The extension generates Pendo-compliant ::shadow selectors to pierce encapsulation boundaries.  
2. **URL Entropy:** Dynamic URLs with UUIDs and session parameters fragment analytics data. The extension normalizes URLs into wildcard rules that aggregate related pages.

# **2\. Target Users**

| Persona | Role | Primary Need |
| :---- | :---- | :---- |
| Product Ops | Maintains analytics data integrity | Point-and-click tagging without manual ::shadow syntax |
| Analytics Engineer | Enables product team instrumentation | Tool that produces stable selectors, reducing support requests |
| QA Specialist | Validates test coverage via Pendo data | Selectors that prioritize stable attributes (data-testid) over dynamic classes |

# **3\. Functional Scope**

The extension provides two modules accessible via a tabbed interface:

## **3.1 Feature Tagging (Shadow DOM Inspector)**

**Purpose:** Generate CSS selectors for elements inside Shadow DOM that Pendo can resolve.

### **Capabilities**

* Real-time DOM inspection with visual element highlighting  
* Traversal of Open Shadow DOM roots using composedPath()  
* Automatic generation of Pendo ::shadow selector syntax  
* Heuristic scoring to select the most stable identifier

### **Selector Priority**

| Priority | Selector Type | Example |
| :---- | :---- | :---- |
| 1 | Custom attribute (data-pendo-id, data-testid) | \[data-testid="submit-order"\] |
| 2 | Unique ID (non-dynamic) | \#nav-home |
| 3 | Unique class \+ element type | button.btn-primary |
| 4 | Structural fallback | div:nth-of-type(3) \> button |

### **Output Examples**

*Light DOM (simple):*

.chooser\_input

*Shadow DOM with attribute selector:*

ex-tooltip \> ex-icon-button::shadow \[aria-label="Download"\]

*Nested Shadow DOM:*

app-shell::shadow side-nav::shadow item-link

## **3.2 Page Tagging (URL Normalizer)**

**Purpose:** Transform dynamic URLs into Pendo page rules that aggregate related pages.

### **Capabilities**

* Automatic detection of dynamic segments (UUIDs, numeric IDs, Base64 strings)  
* Interactive rule builder with segment-by-segment control  
* Query parameter handling (Include, Wildcard, or Exclude)  
* Validation against Pendo URL syntax

### **URL Syntax Reference**

| Syntax | Meaning | Example |
| :---- | :---- | :---- |
| //\* | Domain wildcard (matches any environment) | //\*/pricing |
| \* | Single segment wildcard | //\*/users/\*/settings |
| \*\* | Ignore everything after this point | //\*/devDocs/docs/Changelog/\*\* |
| ?param | Query parameter with any value (omit value) | //\*/search?q |
| ?param=value | Query parameter with exact value | //\*/filter?status=active |
| /segment;matrix | Matrix parameter in path segment | //\*/products;category=\* |
| #base;key | Hash component with any value | //\*/#!build;accountId |
| #base;key=value | Hash component with exact value | //\*/#!view;tab=settings |
| \~contains:text | URL must contain specified text | //\*/\*/\~contains:dashboard |

### **Output Examples**

*Fixed path:*

//\*/control-center/local/clusters

*Ignore-after wildcard:*

//\*/devDocs/docs/Changelog/\*\*

*UUID replacement:*

//\*/account/\*/details

# **4\. User Interface**

## **4.1 Feature Tagging Tab**

| Component | Behavior |
| :---- | :---- |
| Inspector Toggle | Activates element selection mode; cursor becomes crosshair |
| Ancestor Tree Navigator | Clickable visual path from selected element up to root; click any ancestor to include in selector |
| Element Detail Panel | Shows ALL available identifiers for hovered/selected element (see below) |
| Selector Chips | Toggleable chips for each identifier type; user picks what to include |
| Live Selector Preview | Real-time preview updates as user toggles options; includes copy button |
| Custom Attribute Settings | User-defined list of priority HTML attributes (data-testid, data-locator, etc.) |
| Shadow Alert Badge | "SHADOW DOM DETECTED" indicator when inside shadow root |

### **Element Detail Panel Contents**

For each element, the panel displays all available identifiers:

| Identifier Type | Example | Notes |
| :---- | :---- | :---- |
| Tag Name | button, div, my-component | Always shown |
| ID | #submit-btn | Warns if dynamic pattern detected |
| Classes | .btn, .primary-action | Filters CSS-in-JS classes (sc-*, css-*) |
| data-* Attributes | [data-testid="submit"] | All data attributes shown |
| aria-* Attributes | [aria-label="Close"] | Accessibility attributes |
| Other Attributes | [role="button"], [type="submit"] | role, name, title, type, etc. |
| Position | :nth-of-type(2), :nth-child(3) | Structural fallback options |

### **Selector Composition**

Users can compose selectors by:

1. **Navigating ancestors:** Click any element in the ancestor tree to include it as a parent selector  
2. **Toggling identifiers:** Enable/disable individual chips (ID, class, attribute) for each element  
3. **Combining options:** Build precise selectors like `my-component::shadow button.primary[data-testid="submit"]`

## **4.2 Page Tagging Tab**

| Component | Behavior |
| :---- | :---- |
| URL Visualizer | Displays URL as clickable segment chips |
| Segment Controls | Click to cycle: Literal → \* (Wildcard) → \*\* (Ignore After) |
| Parameter Table | Dropdown per query param: Exact Match, Any Value, Ignore |
| Preview Box | Live rule output: //\*/app/projects/\*?sort=date |
| Validation Indicator | Green/red status for Pendo syntax compliance |

# **5\. Technical Requirements**

## **5.1 Platform**

* Chrome Extension using Manifest V3  
* Permissions: activeTab (minimal footprint); optional host\_permissions for persistent overlay

## **5.2 Security**

* **Local-first:** All processing runs client-side. No DOM data or URLs transmitted externally.  
* **PII Sanitization:** Selectors containing email patterns or sensitive data formats are rejected.

## **5.3 Performance**

* **Throttling:** Mouseover events limited to 60fps to prevent UI jank  
* **Lazy Calculation:** Full ::shadow path computed only on hover pause or click lock

# **6\. Known Limitations**

| Constraint | Handling |
| :---- | :---- |
| Closed Shadow Roots | Display warning; generate selector for Shadow Host only (deepest accessible node) |
| Dynamic Classes (CSS-in-JS) | Entropy detection excludes high-entropy classes (e.g., .sc-bdVaJa); warning displayed |
| iFrames (Same-Origin) | Alert user; generate selector relative to iFrame root, not top window |
| iFrames (Cross-Origin) | Cannot access; display error explaining browser security restriction |
| Slotted Content | Default to Light DOM selector; toggle available to target slot container |
| Web Workers | Not applicable; Web Workers have no DOM access |

# **Appendix A: Test Scenarios**

## **A.1 Feature Tagging Scenarios**

| ID | Scenario | Expected Output |
| :---- | :---- | :---- |
| DOM-001 | Standard element (div) | div\#main-content |
| DOM-002 | Shadow Host wrapper | my-component |
| DOM-003 | Element inside Open Shadow | my-component::shadow button\#save |
| DOM-004 | Nested Shadow (3 levels) | app-shell::shadow side-nav::shadow item-link |
| DOM-005 | Slotted content | \#header-title (Light DOM) |
| DOM-006 | Closed Shadow Root | closed-component (Host only) \+ Warning |
| DOM-007 | Dynamic ID collision | Warning: "ID is not unique" |

## **A.2 Page Tagging Scenarios**

| ID | Scenario | Expected Output |
| :---- | :---- | :---- |
| URL-001 | Simple path | //\\*/pricing |
| URL-002 | UUID in path | //\\*/account/\\*/details |
| URL-003 | Query param (UTM) | //\\*/landing (UTM stripped) |
| URL-004 | Query param (any value) | //\\*/search?q |
| URL-005 | Query param (exact value) | //\\*/filter?status=active |
| URL-006 | Hash routing (/\\#/path) | //\\*/\\#\\!/\\*/dashboard |
| URL-007 | Matrix parameters | //\\*/products;category |
| URL-008 | Hash with params | //\\*/#!build;accountId |

# **Appendix B: Dynamic Segment Detection Patterns**

The extension uses these regex patterns to identify likely dynamic URL segments:

| Pattern Type | Regex | Example Match |
| :---- | :---- | :---- |
| UUID/GUID | \\[0-9a-f\\]{8}-\\[0-9a-f\\]{4}-\\[0-9a-f\\]{4}-\\[0-9a-f\\]{4}-\\[0-9a-f\\]{12} | a987fbc9-4bed-3078-cf07-9141ba07c9f3 |
| MongoDB ObjectId | \\[0-9a-f\\]{24} | 507f1f77bcf86cd799439011 |
| Numeric ID | ^\\\\d+$ | 123456 |
| Base64/Short ID | \\[A-Za-z0-9\\_-\\]{20,} | dGhpcyBpcyBhIHRlc3Q |

# **Appendix C: Interactive Selector Builder Test Scenarios**

| ID | Scenario | Expected Behavior |
| :---- | :---- | :---- |
| SEL-001 | Navigate to parent element | Ancestor tree highlights parent; selector updates to include parent |
| SEL-002 | Toggle ID chip on | Selector includes #element-id |
| SEL-003 | Toggle multiple classes | Selector includes .class1.class2 |
| SEL-004 | Add data-testid attribute | Selector includes [data-testid="value"] |
| SEL-005 | Combine ancestor + chips | my-component::shadow button.primary[aria-label="Submit"] |
| SEL-006 | Deselect all chips | Shows warning: "No selectors chosen" |
| SEL-007 | Dynamic ID detection | ID chip shows warning icon; not auto-selected |

# **References**

1. Pendo Support: Tag Features in a shadow DOM - https://support.pendo.io/hc/en-us/articles/360038410952  
2. Pendo Support: URLs for Page tagging - https://support.pendo.io/hc/en-us/articles/360032293371  
3. Pendo Support: Advanced Feature tagging - https://support.pendo.io/hc/en-us/articles/360031950112  
4. Pendo Support: Using CSS selectors in Feature tagging - https://support.pendo.io/hc/en-us/articles/360031863612  
5. MDN Web Docs: Using shadow DOM - https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM

---

# **Changelog**

| Version | Date | Changes |
| :---- | :---- | :---- |
| 1.2.0 | 2026-01-21 | Added Interactive Selector Builder feature (§4.1): Ancestor Tree Navigator, Element Detail Panel, Selector Chips, Selector Composition. Updated URL Syntax Reference with correct Pendo query param syntax, matrix parameters, and hash component handling. Expanded Known Limitations (§6) with cross-origin iframe and web worker notes. Added Appendix C for selector builder test scenarios. |
| 1.1.0 | 2026-01-14 | Added custom HTML attribute settings (replacing fixed checkboxes). Enhanced hash fragment parsing for Boomi-style semicolon syntax. Improved Advanced URL Rule Builder with granular hash component controls. |
| 1.0.0 | Initial | Initial PRD release with Feature Tagging (Shadow DOM Inspector) and Page Tagging (URL Normalizer) modules. |