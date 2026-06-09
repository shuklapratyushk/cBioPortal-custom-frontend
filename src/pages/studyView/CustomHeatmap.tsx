import * as React from 'react';
import { Sample } from 'cbioportal-ts-api-client';

type CustomHeatmapProps = {
    samples: Sample[];
};

const HEATMAP_FEATURES = [
    'RNA Expression',
    'Copy Number',
    'Mutation Burden',
    'Tumor Purity',
    'Immune Score',
];

function getMockValue(sampleIndex: number, featureIndex: number) {
    const raw = Math.sin(sampleIndex * 1.7 + featureIndex * 2.3);
    return raw;
}

function getCellColor(value: number) {
    if (value > 0.6) return '#b2182b';
    if (value > 0.2) return '#ef8a62';
    if (value > -0.2) return '#f7f7f7';
    if (value > -0.6) return '#67a9cf';
    return '#2166ac';
}

export default function CustomHeatmap({ samples }: CustomHeatmapProps) {
    const visibleSamples = samples.slice(0, 30);

    if (!visibleSamples.length) {
        return <div>No samples available for heatmap.</div>;
    }

    return (
        <div>
            <h4>Custom Heatmap</h4>
            <p style={{ color: '#666' }}>
                Prototype heatmap using selected samples. Values are placeholder
                values for now.
            </p>

            <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
                <table
                    style={{
                        borderCollapse: 'collapse',
                        fontSize: 12,
                        minWidth: 700,
                    }}
                >
                    <thead>
                        <tr>
                            <th
                                style={{
                                    padding: 6,
                                    border: '1px solid #ddd',
                                    background: '#f5f5f5',
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 2,
                                }}
                            >
                                Feature
                            </th>
                            {visibleSamples.map(sample => (
                                <th
                                    key={sample.uniqueSampleKey}
                                    style={{
                                        padding: 6,
                                        border: '1px solid #ddd',
                                        background: '#f5f5f5',
                                        writingMode: 'vertical-rl',
                                        transform: 'rotate(180deg)',
                                        maxHeight: 120,
                                    }}
                                >
                                    {sample.sampleId}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {HEATMAP_FEATURES.map((feature, featureIndex) => (
                            <tr key={feature}>
                                <td
                                    style={{
                                        padding: 6,
                                        border: '1px solid #ddd',
                                        fontWeight: 600,
                                        background: '#fafafa',
                                        position: 'sticky',
                                        left: 0,
                                    }}
                                >
                                    {feature}
                                </td>

                                {visibleSamples.map((sample, sampleIndex) => {
                                    const value = getMockValue(
                                        sampleIndex,
                                        featureIndex
                                    );

                                    return (
                                        <td
                                            key={`${sample.uniqueSampleKey}-${feature}`}
                                            title={`${
                                                sample.sampleId
                                            } | ${feature}: ${value.toFixed(
                                                2
                                            )}`}
                                            style={{
                                                width: 24,
                                                height: 24,
                                                border: '1px solid #eee',
                                                background: getCellColor(value),
                                            }}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
