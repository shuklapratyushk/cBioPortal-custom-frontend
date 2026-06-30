import * as React from 'react';
import { Button, FormControl } from 'react-bootstrap';
import { Sample } from 'cbioportal-ts-api-client';

type Props = {
    studyId: string;
    samples: Sample[];
};

type Gene = {
    entrezGeneId: number;
    hugoGeneSymbol: string;
};

type MolecularProfile = {
    molecularProfileId: string;
    name?: string;
    geneticAlterationType?: string;
    datatype?: string;
};

type MolecularDatum = {
    sampleId: string;
    entrezGeneId: number;
    hugoGeneSymbol?: string;
    value: number;
};

const DEFAULT_GENES = 'VHL, PBRM1, BAP1, SETD2, KDM5C';

function getCellColor(value: number | undefined, min: number, max: number) {
    if (value === undefined || Number.isNaN(value)) return '#eee';

    const midpoint = (min + max) / 2;
    if (value >= midpoint) {
        const intensity = Math.min(
            1,
            (value - midpoint) / (max - midpoint || 1)
        );
        return `rgba(178, 24, 43, ${0.2 + intensity * 0.8})`;
    } else {
        const intensity = Math.min(
            1,
            (midpoint - value) / (midpoint - min || 1)
        );
        return `rgba(33, 102, 172, ${0.2 + intensity * 0.8})`;
    }
}

export default function CustomHeatmap({ studyId, samples }: Props) {
    const [geneText, setGeneText] = React.useState(DEFAULT_GENES);
    const [profiles, setProfiles] = React.useState<MolecularProfile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = React.useState('');
    const [genes, setGenes] = React.useState<Gene[]>([]);
    const [data, setData] = React.useState<MolecularDatum[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const visibleSamples = samples.slice(0, 40);
    const sampleIds = visibleSamples.map(s => s.sampleId);

    React.useEffect(() => {
        async function loadProfiles() {
            const res = await fetch(
                `/api/studies/${studyId}/molecular-profiles?projection=DETAILED`
            );
            const allProfiles: MolecularProfile[] = await res.json();

            const rnaProfiles = allProfiles.filter(
                p =>
                    p.geneticAlterationType === 'MRNA_EXPRESSION' ||
                    p.molecularProfileId.includes('rna') ||
                    p.molecularProfileId.includes('mrna')
            );

            setProfiles(rnaProfiles);

            if (rnaProfiles.length > 0) {
                setSelectedProfileId(rnaProfiles[0].molecularProfileId);
            }
        }

        if (studyId) loadProfiles();
    }, [studyId]);

    async function loadHeatmapData() {
        setLoading(true);
        setError('');

        try {
            const geneSymbols = geneText
                .split(/[,\s]+/)
                .map(g => g.trim().toUpperCase())
                .filter(Boolean);

            const genesRes = await fetch(
                '/api/genes/fetch?geneIdType=HUGO_GENE_SYMBOL&projection=SUMMARY',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geneSymbols),
                }
            );

            if (!genesRes.ok) {
                throw new Error(`Gene lookup failed: ${genesRes.status}`);
            }

            const fetchedGenes: Gene[] = await genesRes.json();
            setGenes(fetchedGenes);

            const entrezGeneIds = fetchedGenes.map(g => g.entrezGeneId);

            const dataRes = await fetch(
                `/api/molecular-profiles/${selectedProfileId}/molecular-data/fetch?projection=DETAILED`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entrezGeneIds,
                        sampleIds,
                    }),
                }
            );

            if (!dataRes.ok) {
                throw new Error(`Expression fetch failed: ${dataRes.status}`);
            }

            const expressionData: MolecularDatum[] = await dataRes.json();
            setData(expressionData);
        } catch (e) {
            setError(e.message || 'Could not load heatmap data.');
        } finally {
            setLoading(false);
        }
    }

    const values = data.map(d => d.value).filter(v => v !== undefined);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;

    const dataBySampleGene: { [key: string]: number } = {};
    data.forEach(d => {
        dataBySampleGene[`${d.sampleId}_${d.entrezGeneId}`] = d.value;
    });

    return (
        <div>
            <h4>RNA Expression Heatmap</h4>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div>
                    <label>Genes</label>
                    <FormControl
                        type="text"
                        value={geneText}
                        onChange={(e: any) => setGeneText(e.target.value)}
                        style={{ width: 360 }}
                    />
                </div>

                <div>
                    <label>RNA profile</label>
                    <FormControl
                        componentClass="select"
                        value={selectedProfileId}
                        onChange={(e: any) =>
                            setSelectedProfileId(e.target.value)
                        }
                        style={{ width: 300 }}
                    >
                        {profiles.map(profile => (
                            <option
                                key={profile.molecularProfileId}
                                value={profile.molecularProfileId}
                            >
                                {profile.name || profile.molecularProfileId}
                            </option>
                        ))}
                    </FormControl>
                </div>

                <div style={{ paddingTop: 25 }}>
                    <Button
                        bsStyle="primary"
                        onClick={loadHeatmapData}
                        disabled={!selectedProfileId || loading}
                    >
                        {loading ? 'Loading...' : 'Load heatmap'}
                    </Button>
                </div>
            </div>

            {error && <div className="alert alert-warning">{error}</div>}

            <div style={{ color: '#666', marginBottom: 12 }}>
                Showing up to {visibleSamples.length} selected samples from{' '}
                <strong>{studyId}</strong>.
            </div>

            {genes.length > 0 && (
                <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
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
                                    Gene
                                </th>
                                {visibleSamples.map(sample => (
                                    <th
                                        key={sample.sampleId}
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
                            {genes.map(gene => (
                                <tr key={gene.entrezGeneId}>
                                    <td
                                        style={{
                                            padding: 6,
                                            border: '1px solid #ddd',
                                            fontWeight: 700,
                                            background: '#fafafa',
                                            position: 'sticky',
                                            left: 0,
                                        }}
                                    >
                                        {gene.hugoGeneSymbol}
                                    </td>

                                    {visibleSamples.map(sample => {
                                        const value =
                                            dataBySampleGene[
                                                `${sample.sampleId}_${gene.entrezGeneId}`
                                            ];

                                        return (
                                            <td
                                                key={`${sample.sampleId}-${gene.entrezGeneId}`}
                                                title={`${sample.sampleId} | ${
                                                    gene.hugoGeneSymbol
                                                }: ${
                                                    value !== undefined
                                                        ? value.toFixed(3)
                                                        : 'NA'
                                                }`}
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    border: '1px solid #eee',
                                                    background: getCellColor(
                                                        value,
                                                        min,
                                                        max
                                                    ),
                                                    textAlign: 'center',
                                                }}
                                            />
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
