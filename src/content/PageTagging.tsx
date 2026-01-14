import React, { useState, useEffect, useMemo } from 'react';
import { URLProcessor, URLSegment } from '../services/url-processor';

export const PageTagging: React.FC = () => {
    const processor = useMemo(() => new URLProcessor(), []);
    const [segments, setSegments] = useState<URLSegment[]>([]);

    useEffect(() => {
        const result = processor.analyzeUrl(window.location.href);
        setSegments(result.segments);
    }, [processor]);

    const toggleSegment = (index: number) => {
        const newSegments = [...segments];
        const seg = newSegments[index];

        if (seg.type === 'literal') seg.type = 'wildcard';
        else if (seg.type === 'wildcard') seg.type = 'ignore-after';
        else seg.type = 'literal';

        setSegments(newSegments);
    };

    const generatedUrl = processor.generateRule(segments, new URLSearchParams(window.location.search));

    return (
        <div style={{ padding: '0 4px' }}>
            <label style={{ fontSize: '12px', color: '#666', marginBottom: '8px', display: 'block' }}>
                Click segments to wildcard (*):
            </label>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                marginBottom: '16px',
                background: '#f8f9fa',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #eee'
            }}>
                <span style={{ color: '#aaa', fontSize: '13px' }}>//*/</span>
                {segments.map((seg, i) => (
                    <React.Fragment key={i}>
                        <span
                            onClick={() => toggleSegment(i)}
                            title={`Original: ${seg.originalValue}`}
                            style={{
                                padding: '2px 8px',
                                background: seg.type === 'wildcard' ? '#0066ff11' : seg.type === 'ignore-after' ? '#ff336611' : 'white',
                                border: `1px solid ${seg.type === 'wildcard' ? '#0066ff' : seg.type === 'ignore-after' ? '#ff3366' : '#ddd'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: seg.type === 'wildcard' ? '#0066ff' : seg.type === 'ignore-after' ? '#ff3366' : '#333'
                            }}
                        >
                            {seg.type === 'wildcard' ? '*' : seg.type === 'ignore-after' ? '**' : seg.originalValue}
                        </span>
                        {i < segments.length - 1 && segments[i].type !== 'ignore-after' && <span style={{ color: '#ccc' }}>/</span>}
                        {segments[i].type === 'ignore-after' && i < segments.length - 1 && <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '11px' }}>(ignored)</span>}
                    </React.Fragment>
                ))}
            </div>

            <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                Normalized Page Rule:
            </label>
            <div style={{
                background: '#f4f4f4',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '13px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                border: '1px solid #ddd'
            }}>
                {generatedUrl}
            </div>

            <button
                onClick={() => navigator.clipboard.writeText(generatedUrl)}
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
                Copy Page Rule
            </button>
        </div>
    );
};
