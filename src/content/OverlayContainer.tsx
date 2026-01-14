import React, { useState, useEffect, useRef } from 'react';
import { Inspector } from './inspector';
import { PageTagging } from './PageTagging';

interface OverlayProps {
    inspector: Inspector;
}

export const OverlayContainer: React.FC<OverlayProps> = ({ inspector }) => {
    const [activeTab, setActiveTab] = useState<'feature' | 'page'>('feature');
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [isInspectorActive, setIsInspectorActive] = useState(false);
    const [lastSelector, setLastSelector] = useState('');
    const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
    const [isInsideShadow, setIsInsideShadow] = useState(false);
    const [options, setOptions] = useState<any>({
        priorityAttributes: ['data-testid', 'data-pendo-id', 'aria-label'],
        prioritizeIds: true
    });
    const [newAttr, setNewAttr] = useState('');

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

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent dragging when clicking buttons or inputs
        if (['BUTTON', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;
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
            inspector.activate((analysis) => {
                setLastSelector(analysis.selector);
                setBreadcrumbs(analysis.breadcrumbs);
                setIsInsideShadow(analysis.isInsideShadow);
                inspector.deactivate();
                setIsInspectorActive(false);
            });
            setIsInspectorActive(true);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: '320px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                zIndex: 2147483646,
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

            <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
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

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#444', marginBottom: '8px', display: 'block' }}>
                                Priority Attributes
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

                        {isInsideShadow && (
                            <div style={{
                                background: '#fff3cd',
                                color: '#856404',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                marginBottom: '12px',
                                border: '1px solid #ffeeba',
                                textAlign: 'center'
                            }}>
                                SHADOW DOM DETECTED
                            </div>
                        )}

                        {breadcrumbs.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
                                    Hierarchy:
                                </label>
                                <div style={{ fontSize: '11px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                    {breadcrumbs.map((b, i) => (
                                        <React.Fragment key={i}>
                                            <span style={{
                                                background: b === '::shadow' ? '#eef' : '#eee',
                                                padding: '2px 4px',
                                                borderRadius: '3px',
                                                color: b === '::shadow' ? '#0066ff' : '#333'
                                            }}>
                                                {b}
                                            </span>
                                            {i < breadcrumbs.length - 1 && <span style={{ color: '#ccc' }}>&gt;</span>}
                                        </React.Fragment>
                                    ))}
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
                                        padding: '8px',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        wordBreak: 'break-all',
                                        fontFamily: 'monospace',
                                        border: '1px solid #ddd'
                                    }}
                                >
                                    {lastSelector}
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(lastSelector)}
                                    style={{
                                        marginTop: '8px',
                                        width: '100%',
                                        padding: '6px',
                                        background: 'white',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    Copy to Clipboard
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
