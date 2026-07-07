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

type NormalizationMode = 'rowZScore' | 'globalMinMax';

const DEFAULT_GENES = 'VHL, PBRM1, BAP1, SETD2, KDM5C';

function getGlobalMinMaxCellColor(
    value: number | undefined,
    min: number,
    max: number
) {
    if (value === undefined || Number.isNaN(value)) return '#eee';

    const midpoint = (min + max) / 2;

    if (value >= midpoint) {
        const intensity = Math.min(
            1,
            (value - midpoint) / (max - midpoint || 1)
        );

        return `rgba(178, 24, 43, ${0.2 + intensity * 0.8})`;
    }

    const intensity = Math.min(1, (midpoint - value) / (midpoint - min || 1));

    return `rgba(33, 102, 172, ${0.2 + intensity * 0.8})`;
}

function getRowZScoreCellColor(value: number | undefined) {
    if (value === undefined || Number.isNaN(value)) return '#eee';

    const clipped = Math.max(-2, Math.min(2, value));
    const intensity = Math.abs(clipped) / 2;

    if (clipped >= 0) {
        return `rgba(178, 24, 43, ${0.15 + intensity * 0.85})`;
    }

    return `rgba(33, 102, 172, ${0.15 + intensity * 0.85})`;
}

function calculateRowZScores(
    genes: Gene[],
    visibleSamples: Sample[],
    dataBySampleGene: { [key: string]: number }
) {
    const zScoresBySampleGene: { [key: string]: number } = {};

    genes.forEach(gene => {
        const rowValues = visibleSamples
            .map(
                sample =>
                    dataBySampleGene[`${sample.sampleId}_${gene.entrezGeneId}`]
            )
            .filter(
                value => value !== undefined && !Number.isNaN(value)
            ) as number[];

        if (rowValues.length === 0) {
            return;
        }

        const mean =
            rowValues.reduce((sum, value) => sum + value, 0) / rowValues.length;

        const variance =
            rowValues.reduce(
                (sum, value) => sum + Math.pow(value - mean, 2),
                0
            ) / rowValues.length;

        const standardDeviation = Math.sqrt(variance) || 1;

        visibleSamples.forEach(sample => {
            const key = `${sample.sampleId}_${gene.entrezGeneId}`;
            const rawValue = dataBySampleGene[key];

            if (rawValue !== undefined && !Number.isNaN(rawValue)) {
                zScoresBySampleGene[key] =
                    (rawValue - mean) / standardDeviation;
            }
        });
    });

    return zScoresBySampleGene;
}

export default function CustomHeatmap({ studyId, samples }: Props) {
    const [geneText, setGeneText] = React.useState(DEFAULT_GENES);
    const [profiles, setProfiles] = React.useState<MolecularProfile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = React.useState('');
    const [genes, setGenes] = React.useState<Gene[]>([]);
    const [data, setData] = React.useState<MolecularDatum[]>([]);
    const [normalizationMode, setNormalizationMode] = React.useState<
        NormalizationMode
    >('rowZScore');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const visibleSamples = samples.slice(0, 40);
    const sampleIds = visibleSamples.map(sample => sample.sampleId);

    React.useEffect(() => {
        async function loadProfiles() {
            try {
                setError('');

                const response = await fetch(
                    `/api/studies/${studyId}/molecular-profiles?projection=DETAILED`
                );

                if (!response.ok) {
                    throw new Error(
                        `Could not load molecular profiles: ${response.status}`
                    );
                }

                const allProfiles: MolecularProfile[] = await response.json();

                const rnaProfiles = allProfiles.filter(
                    profile =>
                        profile.geneticAlterationType === 'MRNA_EXPRESSION' ||
                        profile.molecularProfileId
                            .toLowerCase()
                            .includes('rna') ||
                        profile.molecularProfileId
                            .toLowerCase()
                            .includes('mrna')
                );

                setProfiles(rnaProfiles);

                if (rnaProfiles.length > 0) {
                    setSelectedProfileId(rnaProfiles[0].molecularProfileId);
                }
            } catch (err) {
                setError(err.message || 'Could not load RNA profiles.');
            }
        }

        if (studyId) {
            loadProfiles();
        }
    }, [studyId]);

    async function loadHeatmapData() {
        setLoading(true);
        setError('');

        try {
            const geneSymbols = geneText
                .split(/[,\s]+/)
                .map(gene => gene.trim().toUpperCase())
                .filter(Boolean);

            if (geneSymbols.length === 0) {
                throw new Error('Please enter at least one gene symbol.');
            }

            if (sampleIds.length === 0) {
                throw new Error('No selected samples are available.');
            }

            const genesResponse = await fetch(
                '/api/genes/fetch?geneIdType=HUGO_GENE_SYMBOL&projection=SUMMARY',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geneSymbols),
                }
            );

            if (!genesResponse.ok) {
                throw new Error(`Gene lookup failed: ${genesResponse.status}`);
            }

            const fetchedGenes: Gene[] = await genesResponse.json();
            setGenes(fetchedGenes);

            if (fetchedGenes.length === 0) {
                throw new Error('No matching genes found.');
            }

            const entrezGeneIds = fetchedGenes.map(gene => gene.entrezGeneId);

            const dataResponse = await fetch(
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

            if (!dataResponse.ok) {
                throw new Error(
                    `Expression fetch failed: ${dataResponse.status}`
                );
            }

            const expressionData: MolecularDatum[] = await dataResponse.json();
            setData(expressionData);
        } catch (err) {
            setError(err.message || 'Could not load heatmap data.');
        } finally {
            setLoading(false);
        }
    }

    const rawValues = data
        .map(datum => datum.value)
        .filter(value => value !== undefined && !Number.isNaN(value));

    const globalMin = rawValues.length ? Math.min(...rawValues) : 0;
    const globalMax = rawValues.length ? Math.max(...rawValues) : 1;

    const dataBySampleGene: { [key: string]: number } = {};
    data.forEach(datum => {
        dataBySampleGene[`${datum.sampleId}_${datum.entrezGeneId}`] =
            datum.value;
    });

    const rowZScoresBySampleGene = calculateRowZScores(
        genes,
        visibleSamples,
        dataBySampleGene
    );

    return (
        <div>
            <h4>RNA Expression Heatmap</h4>

            <p style={{ color: '#666', maxWidth: 900 }}>
                Expression values are loaded from the selected RNA molecular
                profile. Row-wise z-score normalization standardizes each gene
                independently across the displayed samples.
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 16,
                    alignItems: 'flex-end',
                    flexWrap: 'wrap',
                }}
            >
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

                <div>
                    <label>Normalization</label>
                    <FormControl
                        componentClass="select"
                        value={normalizationMode}
                        onChange={(e: any) =>
                            setNormalizationMode(e.target.value)
                        }
                        style={{ width: 220 }}
                    >
                        <option value="rowZScore">Row-wise z-score</option>
                        <option value="globalMinMax">Global min/max</option>
                    </FormControl>
                </div>

                <div>
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
                <strong>{studyId}</strong>. Current normalization:{' '}
                <strong>
                    {normalizationMode === 'rowZScore'
                        ? 'row-wise z-score'
                        : 'global min/max'}
                </strong>
                .
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
                                        const key = `${sample.sampleId}_${gene.entrezGeneId}`;
                                        const rawValue = dataBySampleGene[key];

                                        const displayedValue =
                                            normalizationMode === 'rowZScore'
                                                ? rowZScoresBySampleGene[key]
                                                : rawValue;

                                        const background =
                                            normalizationMode === 'rowZScore'
                                                ? getRowZScoreCellColor(
                                                      displayedValue
                                                  )
                                                : getGlobalMinMaxCellColor(
                                                      rawValue,
                                                      globalMin,
                                                      globalMax
                                                  );

                                        const valueLabel =
                                            displayedValue !== undefined
                                                ? displayedValue.toFixed(3)
                                                : 'NA';

                                        const rawValueLabel =
                                            rawValue !== undefined
                                                ? rawValue.toFixed(3)
                                                : 'NA';

                                        return (
                                            <td
                                                key={`${sample.sampleId}-${gene.entrezGeneId}`}
                                                title={`${sample.sampleId} | ${gene.hugoGeneSymbol} | displayed: ${valueLabel} | raw: ${rawValueLabel}`}
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    border: '1px solid #eee',
                                                    background,
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

            {genes.length > 0 && (
                <div style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
                    Row-wise z-score: each gene row is centered by its own mean
                    and scaled by its own standard deviation across the
                    displayed samples. Values are clipped visually at ±2
                    z-scores.
                </div>
            )}
        </div>
    );
}
