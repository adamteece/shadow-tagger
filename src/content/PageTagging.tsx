import React, { useState, useEffect, useMemo } from 'react';
import { URLProcessor, URLRuleState, URLSegment, URLQueryParam, URLHashComponent } from '../services/url-processor';

export const PageTagging: React.FC = () => {
    const processor = useMemo(() => new URLProcessor(), []);
    const [state, setState] = useState<URLRuleState | null>(null);

    useEffect(() => {
        const initialState = processor.analyzeUrl(window.location.href);
        setState(initialState);
    }, [processor]);

    if (!state) return null;

    const updateState = (updates: Partial<URLRuleState>) => {
        setState(prev => prev ? { ...prev, ...updates } : null);
    };

    const togglePathSegment = (index: number) => {
        const newSegments = [...state.pathSegments];
        const seg = newSegments[index];

        if (seg.type === 'literal') seg.type = 'wildcard';
        else if (seg.type === 'wildcard') seg.type = 'ignore-after';
        else seg.type = 'literal';

        updateState({ pathSegments: newSegments });
    };

    const updateQueryParam = (index: number, type: URLQueryParam['type']) => {
        const newParams = [...state.queryParams];
        newParams[index].type = type;
        updateState({ queryParams: newParams });
    };

    const updateHashComponent = (index: number, type: URLHashComponent['type']) => {
        const newHash = [...state.hashComponents];
        newHash[index].type = type;
        updateState({ hashComponents: newHash });
    };

    const generatedUrl = processor.generateRule(state);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Domain Section */}
            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>DOMAIN</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: state.includeDomain ? '#333' : '#999' }}>Include</span>
                        <input
                            type="checkbox"
                            checked={state.includeDomain}
                            onChange={e => updateState({ includeDomain: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                    </div>
                </div>
                {state.includeDomain && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', background: '#f0f4ff', padding: '6px', borderRadius: '4px' }}>
                        <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                checked={state.domainWildcard}
                                onChange={() => updateState({ domainWildcard: true })}
                            />
                            Wildcard (//*/)
                        </label>
                        <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                checked={!state.domainWildcard}
                                onChange={() => updateState({ domainWildcard: false })}
                            />
                            Literal
                        </label>
                    </div>
                )}
            </section>

            {/* Path Section */}
            <section>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '8px', display: 'block' }}>
                    PATH & MATRIX PARAMETERS
                </label>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    alignItems: 'center',
                    background: '#f8f9fa',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #eee'
                }}>
                    {!state.includeDomain && <span style={{ color: '#aaa', fontSize: '13px', marginRight: '4px' }}>//*/</span>}
                    {state.pathSegments.map((seg, i) => (
                        <React.Fragment key={i}>
                            {seg.isMatrix && <span style={{ color: '#aaa', fontWeight: 'bold' }}>;</span>}
                            <span
                                onClick={() => togglePathSegment(i)}
                                style={{
                                    padding: '2px 8px',
                                    background: seg.type === 'wildcard' ? '#0066ff11' : seg.type === 'ignore-after' ? '#ff336611' : 'white',
                                    border: `1px solid ${seg.type === 'wildcard' ? '#0066ff' : seg.type === 'ignore-after' ? '#ff3366' : '#ddd'}`,
                                    borderRadius: seg.isMatrix ? '12px' : '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: seg.type === 'wildcard' ? '#0066ff' : seg.type === 'ignore-after' ? '#ff3366' : '#333',
                                    fontStyle: seg.isMatrix ? 'italic' : 'normal'
                                }}
                                title={seg.originalValue}
                            >
                                {seg.type === 'wildcard' ? (seg.originalValue.includes('=') ? `${seg.originalValue.split('=')[0]}=*` : '*') : seg.originalValue}
                                {seg.type === 'ignore-after' && ' **'}
                            </span>
                            {i < state.pathSegments.length - 1 && !state.pathSegments[i + 1].isMatrix && state.pathSegments[i].type !== 'ignore-after' && (
                                <span style={{ color: '#ccc', margin: '0 2px' }}>/</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </section>

            {/* Query Section */}
            {state.queryParams.length > 0 && (
                <section>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '8px', display: 'block' }}>
                        QUERY PARAMETERS
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {state.queryParams.map((param, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '12px',
                                background: param.type === 'exclude' ? '#fff0f0' : '#fdfdfd',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: `1px solid ${param.type === 'exclude' ? '#ffdada' : '#f0f0f0'}`
                            }}>
                                <span style={{ fontWeight: 500, color: param.type === 'exclude' ? '#cc0000' : '#333' }}>
                                    {param.key}
                                    <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '4px' }}>
                                        {param.type === 'exact' ? `=${param.value}` : ' (match any value)'}
                                    </span>
                                </span>
                                <select
                                    value={param.type}
                                    onChange={e => updateQueryParam(i, e.target.value as any)}
                                    style={{
                                        fontSize: '11px',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="wildcard">Any Value (omitted)</option>
                                    <option value="exact">Exact Value</option>
                                    <option value="exclude">Exclude</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Hash Section */}
            {state.hashComponents.length > 0 && (
                <section>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '8px', display: 'block' }}>
                        HASH / FRAGMENT COMPONENTS
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {state.hashComponents.map((comp, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '12px',
                                background: comp.type === 'exclude' ? '#fff0f0' : '#fffdf8',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: `1px solid ${comp.type === 'exclude' ? '#ffdada' : '#ffe8cc'}`
                            }}>
                                <span style={{ fontWeight: 600, color: comp.type === 'exclude' ? '#cc0000' : '#854d0e' }}>
                                    {comp.isBase ? '#' : ';'}{comp.key}
                                    {comp.value && (
                                        <span style={{ color: '#999', fontWeight: 'normal', fontStyle: 'italic', marginLeft: '4px' }}>
                                            {comp.type === 'exact' ? `=${comp.value.length > 20 ? comp.value.substring(0, 20) + '...' : comp.value}` : ' (any value)'}
                                        </span>
                                    )}
                                </span>
                                <select
                                    value={comp.type}
                                    onChange={e => updateHashComponent(i, e.target.value as any)}
                                    style={{
                                        fontSize: '11px',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        border: '1px solid #eee',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="exact">Exact</option>
                                    <option value="wildcard">Any Value</option>
                                    <option value="exclude">Exclude</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Preview Section */}
            <section style={{
                marginTop: '8px',
                paddingTop: '16px',
                borderTop: '2px dashed #eee'
            }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#0066ff', marginBottom: '6px', display: 'block' }}>
                    FINAL PENDO PAGE RULE
                </label>
                <div style={{
                    background: '#333',
                    color: '#00ff00',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    border: '1px solid #222',
                    lineHeight: '1.5',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                }}>
                    {generatedUrl}
                </div>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(generatedUrl);
                    }}
                    style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '10px',
                        background: '#0066ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '13px',
                        boxShadow: '0 4px 6px rgba(0, 102, 255, 0.2)',
                        transition: 'transform 0.1s, background 0.2s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Copy Rule
                </button>
            </section>
        </div>
    );
};
