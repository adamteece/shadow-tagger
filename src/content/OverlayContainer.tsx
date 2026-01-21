import React, { useState, useEffect, useRef } from 'react';
import { Inspector, InspectorAnalysis } from './inspector';
import { PageTagging } from './PageTagging';
import { ElementNode } from '../services/selector-engine';

interface OverlayProps {
    inspector: Inspector;
}

export const OverlayContainer: React.FC<OverlayProps> = ({ inspector }) => {
    const [activeTab, setActiveTab] = useState<'feature' | 'page'>('feature');
    const [position, setPosition] = useState(() => ({
        x: Math.max(20, window.innerWidth - 370),
        y: 20
    }));
    const [isInspectorActive, setIsInspectorActive] = useState(false);
    const [lastSelector, setLastSelector] = useState('');
    const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
    const [isInsideShadow, setIsInsideShadow] = useState(false);
    const [selectorPath, setSelectorPath] = useState<ElementNode[]>([]);
    const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);
    const [matchCount, setMatchCount] = useState<number>(0);
    const [options, setOptions] = useState<any>({
        priorityAttributes: ['data-testid', 'data-pendo-id', 'aria-label'],
        prioritizeIds: true
    });
    const [newAttr, setNewAttr] = useState('');

    useEffect(() => {
        const handleResize = () => {
            setPosition(prev => ({
                x: Math.max(20, Math.min(prev.x, window.innerWidth - 370)),
                y: Math.max(20, Math.min(prev.y, window.innerHeight - 100))
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Load settings from storage on mount
        chrome.storage.local.get(['selectorOptions'], (result) => {
            if (result.selectorOptions) {
                setOptions(result.selectorOptions);
                inspector.setOptions(result.selectorOptions);
            }
        });
    }, [inspector]);

    const updateOptions = (newOptions: any) => {
        setOptions(newOptions);
        inspector.setOptions(newOptions);
        chrome.storage.local.set({ selectorOptions: newOptions });
    };

    const addAttribute = () => {
        if (!newAttr.trim()) return;
        const newAttrs = [...options.priorityAttributes];
        if (!newAttrs.includes(newAttr.trim())) {
            newAttrs.push(newAttr.trim());
            updateOptions({ ...options, priorityAttributes: newAttrs });
        }
        setNewAttr('');
    };

    const removeAttribute = (attr: string) => {
        const newAttrs = options.priorityAttributes.filter((a: string) => a !== attr);
        updateOptions({ ...options, priorityAttributes: newAttrs });
    };

    const draggingRef = useRef(false);
    const offsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (lastSelector) {
            const matches = inspector.getEngine().queryPendoSelector(lastSelector);
            setMatchCount(matches.length);
            inspector.getHighlighter().highlightSelection(matches);
        } else {
            setMatchCount(0);
            inspector.getHighlighter().clearSelection();
        }
    }, [lastSelector, inspector]);

    useEffect(() => {
        const handleUpdate = () => {
            inspector.getHighlighter().refresh();
        };

        window.addEventListener('scroll', handleUpdate, { capture: true, passive: true });
        window.addEventListener('resize', handleUpdate);

        return () => {
            window.removeEventListener('scroll', handleUpdate, { capture: true });
            window.removeEventListener('resize', handleUpdate);
        };
    }, [inspector]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent dragging when clicking buttons or inputs
        if (['BUTTON', 'INPUT', 'SPAN', 'DIV'].includes((e.target as HTMLElement).tagName) &&
            (e.target as HTMLElement).onclick) return;

        // If it's a clickable chip or nav item, don't drag
        if ((e.target as HTMLElement).closest('[data-no-drag]')) return;

        draggingRef.current = true;
        offsetRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current) return;
            setPosition({
                x: e.clientX - offsetRef.current.x,
                y: e.clientY - offsetRef.current.y
            });
        };

        const handleMouseUp = () => {
            draggingRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [position]);

    const toggleInspector = () => {
        if (isInspectorActive) {
            inspector.deactivate();
            setIsInspectorActive(false);
        } else {
            // Clear any existing selection highlights when starting new inspection
            inspector.getHighlighter().clearSelection();

            inspector.activate((analysis) => {
                setLastSelector(analysis.selector);
                setBreadcrumbs(analysis.breadcrumbs);
                setIsInsideShadow(analysis.isInsideShadow);
                setSelectorPath(analysis.path);
                setSelectedNodeIndex(0);
                inspector.deactivate();
                setIsInspectorActive(false);
            });
            setIsInspectorActive(true);
        }
    };

    const toggleNodeIncluded = (index: number) => {
        const newPath = [...selectorPath];
        newPath[index].included = !newPath[index].included;
        setSelectorPath(newPath);
        setLastSelector(inspector.getEngine().generateSelectorFromPath(newPath));
    };

    const toggleIdentifier = (nodeIndex: number, idIndex: number) => {
        const newPath = [...selectorPath];
        const ident = newPath[nodeIndex].identifiers[idIndex];
        ident.enabled = !ident.enabled;

        // If enabling any identifier, ensure node is included
        if (ident.enabled) {
            newPath[nodeIndex].included = true;
        }

        setSelectorPath(newPath);
        setLastSelector(inspector.getEngine().generateSelectorFromPath(newPath));
    };

    return (
        <div
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: '350px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                zIndex: 2147483647,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                overflow: 'hidden',
                userSelect: 'none'
            }}
        >
            <div
                onMouseDown={handleMouseDown}
                style={{
                    padding: '12px 16px',
                    background: '#0066ff',
                    color: 'white',
                    cursor: 'grab',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: '600'
                }}
            >
                <span>Shadow Tagger</span>
                <div style={{ opacity: 0.8, fontSize: '12px' }}>⋮⋮</div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                <button
                    onClick={() => setActiveTab('feature')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: activeTab === 'feature' ? 'white' : '#f8f9fa',
                        border: 'none',
                        borderBottom: activeTab === 'feature' ? '2px solid #0066ff' : 'none',
                        color: activeTab === 'feature' ? '#0066ff' : '#666',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Features
                </button>
                <button
                    onClick={() => setActiveTab('page')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: activeTab === 'page' ? 'white' : '#f8f9fa',
                        border: 'none',
                        borderBottom: activeTab === 'page' ? '2px solid #0066ff' : 'none',
                        color: activeTab === 'page' ? '#0066ff' : '#666',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Pages
                </button>
            </div>

            <div style={{ padding: '16px', maxHeight: '600px', overflowY: 'auto' }}>
                {activeTab === 'feature' ? (
                    <>
                        <button
                            onClick={toggleInspector}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: isInspectorActive ? '#ff3366' : '#0066ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'background 0.2s',
                                marginBottom: '16px'
                            }}
                        >
                            {isInspectorActive ? 'Cancel Inspect' : 'Inspect Element'}
                        </button>

                        {!selectorPath.length && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#444', marginBottom: '8px', display: 'block' }}>
                                    Default Settings
                                </label>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                    {options.priorityAttributes.map((attr: string) => (
                                        <span key={attr} style={{
                                            background: '#eef',
                                            color: '#0066ff',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            border: '1px solid #cce0ff'
                                        }}>
                                            {attr}
                                            <button
                                                onClick={() => removeAttribute(attr)}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    color: '#ff3366',
                                                    cursor: 'pointer',
                                                    padding: '0 2px',
                                                    fontSize: '14px',
                                                    lineHeight: 1
                                                }}
                                            >×</button>
                                        </span>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={newAttr}
                                        onChange={(e) => setNewAttr(e.target.value)}
                                        placeholder="Add attribute (e.g. data-testid)"
                                        style={{
                                            flex: 1,
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            outline: 'none'
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && addAttribute()}
                                    />
                                    <button
                                        onClick={addAttribute}
                                        style={{
                                            background: '#0066ff',
                                            color: 'white',
                                            border: 'none',
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>

                                <label style={{ fontSize: '11px', color: '#666', display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={options.prioritizeIds}
                                        onChange={(e) => updateOptions({ ...options, prioritizeIds: e.target.checked })}
                                    />
                                    Prioritize unique IDs
                                </label>
                            </div>
                        )}

                        {selectorPath.length > 0 && (
                            <div style={{ marginTop: '0' }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '6px', display: 'block' }}>
                                        Selector Path (Double-click to toggle ancestor)
                                    </label>
                                    <div
                                        data-no-drag
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            fontSize: '11px',
                                            alignItems: 'center',
                                            maxHeight: '80px',
                                            overflowY: 'auto',
                                            padding: '6px',
                                            background: '#f8f9fa',
                                            borderRadius: '6px',
                                            border: '1px solid #eee'
                                        }}
                                    >
                                        {selectorPath.slice().reverse().map((node, i) => {
                                            const originalIndex = selectorPath.length - 1 - i;
                                            return (
                                                <React.Fragment key={originalIndex}>
                                                    <div
                                                        onClick={() => setSelectedNodeIndex(originalIndex)}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleNodeIncluded(originalIndex);
                                                        }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: originalIndex === selectedNodeIndex ? '#0066ff' : (node.included ? '#e7f0ff' : 'transparent'),
                                                            color: originalIndex === selectedNodeIndex ? 'white' : (node.included ? '#0066ff' : '#999'),
                                                            border: originalIndex === selectedNodeIndex ? '1px solid #0066ff' : (node.included ? '1px solid #cce0ff' : '1px solid transparent'),
                                                            fontWeight: node.included ? '600' : 'normal',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '2px'
                                                        }}
                                                    >
                                                        {node.tagName}
                                                        {node.isShadowBoundary && <span style={{ color: originalIndex === selectedNodeIndex ? 'rgba(255,255,255,0.7)' : '#0066ff', fontSize: '9px' }}>::shadow</span>}
                                                    </div>
                                                    {i < selectorPath.length - 1 && <span style={{ color: '#ccc' }}>&gt;</span>}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{
                                    background: '#fff',
                                    border: '1px solid #eee',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '16px',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#333' }}>
                                            {selectorPath[selectedNodeIndex].tagName.toUpperCase()} Attributes
                                            {selectedNodeIndex > 0 && <span style={{ color: '#999', marginLeft: '4px', fontWeight: 'normal' }}> (Ancestor)</span>}
                                        </span>
                                        <label style={{ fontSize: '11px', color: '#0066ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectorPath[selectedNodeIndex].included}
                                                onChange={() => toggleNodeIncluded(selectedNodeIndex)}
                                            />
                                            Include Node
                                        </label>
                                    </div>

                                    <div data-no-drag style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {selectorPath[selectedNodeIndex].identifiers.map((ident, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => toggleIdentifier(selectedNodeIndex, idx)}
                                                style={{
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    background: ident.enabled ? '#0066ff' : '#f0f0f0',
                                                    color: ident.enabled ? 'white' : '#666',
                                                    border: '1px solid',
                                                    borderColor: ident.enabled ? '#0066ff' : '#ddd',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.1s',
                                                    maxWidth: '100%',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={ident.value + (ident.warning ? ` (${ident.warning})` : '')}
                                            >
                                                {ident.warning && <span>⚠️</span>}
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ident.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {selectorPath[selectedNodeIndex].identifiers.filter(i => i.enabled).length === 0 && selectorPath[selectedNodeIndex].included && (
                                        <div style={{ fontSize: '10px', color: '#ff3366', marginTop: '8px' }}>
                                            Warning: No attributes selected. This node will be invisible in the selector.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {lastSelector && (
                            <div style={{ marginTop: '16px' }}>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                                    Generated Selector:
                                </label>
                                <div
                                    style={{
                                        background: '#f4f4f4',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        wordBreak: 'break-all',
                                        fontFamily: 'monospace',
                                        border: '1px solid #ddd',
                                        maxHeight: '100px',
                                        overflowY: 'auto'
                                    }}
                                >
                                    {lastSelector}
                                </div>

                                <div style={{ fontSize: '11px', color: '#666', marginTop: '6px', textAlign: 'right' }}>
                                    Matching elements: {matchCount}
                                </div>

                                <button
                                    onClick={() => navigator.clipboard.writeText(lastSelector)}
                                    style={{
                                        marginTop: '8px',
                                        width: '100%',
                                        padding: '8px',
                                        background: 'white',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                    }}
                                >
                                    Copy to Clipboard
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectorPath([]);
                                        setLastSelector('');
                                        inspector.getHighlighter().clearSelection();
                                    }}
                                    style={{
                                        marginTop: '8px',
                                        width: '100%',
                                        padding: '4px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#666',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Clear Selection
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <PageTagging />
                )}
            </div>
        </div>
    );
};

