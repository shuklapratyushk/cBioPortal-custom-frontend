import * as React from 'react';

type Props = {
    studyId: string;
    patientId: string;
};

type ApiSample = {
    studyId: string;
    patientId: string;
    sampleId: string;
    sampleType?: string;
    sequenced?: boolean;
    copyNumberSegmentPresent?: boolean;
};

type ClinicalDataRow = {
    studyId?: string;
    patientId?: string;
    sampleId?: string;
    clinicalAttributeId?: string;
    value?: string;
};

type RawAttributes = { [key: string]: string };

type ProvenanceConfidence =
    | 'explicit-parent'
    | 'metadata-grouped'
    | 'unresolved';

type CanonicalSample = {
    studyId: string;
    patientId: string;
    sampleId: string;
    label: string;
    clinicalType?: string;
    apiSampleType?: string;
    source?: string;
    site?: string;
    siteFinal?: string;
    pattern?: string;
    parentSampleId?: string;
    passage?: number;
    isTumorGraft: boolean;
    provenanceConfidence: ProvenanceConfidence;
    sequenced: boolean;
    copyNumberSegmentPresent: boolean;
    raw: RawAttributes;
};

type NodeType =
    | 'patient'
    | 'source'
    | 'specimen'
    | 'tumorgraft'
    | 'cellline'
    | 'unknown';

type ProvenanceNode = {
    id: string;
    parentId?: string;
    label: string;
    nodeType: NodeType;
    status?: string;
    metadata?: { [key: string]: string | number | boolean | undefined };
    raw?: RawAttributes;
};

type TreeNode = ProvenanceNode & {
    children: TreeNode[];
};

type HttpError = Error & {
    status?: number;
};

type MolecularProfile = {
    molecularProfileId: string;
    name?: string;
    molecularAlterationType?: string;
    datatype?: string;
};

type MutationRecord = {
    sampleId: string;
    chr?: string;
    startPosition?: number;
    referenceAllele?: string;
    variantAllele?: string;
    tumorSeqAllele2?: string;
    proteinChange?: string;
    variantType?: string;
    mutationType?: string;
    gene?: {
        hugoGeneSymbol?: string;
    };
};

type MutationComparison = {
    sourceComparableCount: number;
    tumorGraftComparableCount: number;
    sharedCount: number;
    sourceOnlyCount: number;
    tumorGraftOnlyCount: number;
    unionCount: number;
    retention: number;
    jaccard: number;
    excludedSourceCount: number;
    excludedTumorGraftCount: number;
    shared: MutationRecord[];
    sourceOnly: MutationRecord[];
    tumorGraftOnly: MutationRecord[];
};

type MutationView = 'shared' | 'source-only' | 'tumorgraft-only';

const ATTRIBUTE_ALIASES = {
    label: ['SAMPLE_LABEL', 'SAMPLE_NAME', 'LABEL'],
    clinicalType: [
        'TYPE',
        'SAMPLE_TYPE',
        'SPECIMEN_TYPE',
        'MODEL_TYPE',
        'SAMPLE_CLASS',
    ],
    source: ['SOURCE', 'SAMPLE_SOURCE', 'TISSUE_SOURCE', 'ORIGIN'],
    site: ['SITE', 'ANATOMIC_SITE', 'ANATOMICAL_SITE', 'TUMOR_SITE'],
    siteFinal: ['SITE_FINAL', 'FINAL_SITE', 'SITE_GROUP'],
    pattern: ['PATTERN', 'GROWTH_PATTERN'],
    parentSampleId: [
        'PARENT_SAMPLE_ID',
        'PARENT_ID',
        'SOURCE_SAMPLE_ID',
        'DERIVED_FROM',
    ],
    passage: ['PASSAGE', 'PASSAGE_NUMBER', 'PASSAGE_NUM'],
};

function normalizeAttributeKey(value: string) {
    return value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeToken(value?: string) {
    return (value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function getAliasedValue(raw: RawAttributes, aliases: string[]) {
    const normalizedAliases = new Set(aliases.map(normalizeAttributeKey));

    for (const key of Object.keys(raw)) {
        if (normalizedAliases.has(normalizeAttributeKey(key))) {
            const value = raw[key];
            if (value !== undefined && value !== '') {
                return value;
            }
        }
    }

    return undefined;
}

function rowsToRawAttributes(rows: ClinicalDataRow[]): RawAttributes {
    return rows.reduce((accumulator, row) => {
        if (row.clinicalAttributeId && row.value !== undefined) {
            accumulator[row.clinicalAttributeId] = row.value;
        }
        return accumulator;
    }, {} as RawAttributes);
}

function parseExplicitPassage(value?: string) {
    if (!value) return undefined;

    const match = value.trim().match(/^(?:P)?(\d+)$/i);
    if (!match) return undefined;

    return Number(match[1]);
}

function isExplicitTumorGraftType(value?: string) {
    const token = normalizeToken(value);

    return (
        token === 'TG' ||
        token === 'TUMORGRAFT' ||
        token === 'TUMOR GRAFT' ||
        token === 'XENOGRAFT' ||
        token === 'PDX' ||
        token === 'PATIENT DERIVED XENOGRAFT'
    );
}

function normalizeSample(
    sample: ApiSample,
    raw: RawAttributes
): CanonicalSample {
    const label =
        getAliasedValue(raw, ATTRIBUTE_ALIASES.label) || sample.sampleId;
    const clinicalType = getAliasedValue(raw, ATTRIBUTE_ALIASES.clinicalType);
    const source = getAliasedValue(raw, ATTRIBUTE_ALIASES.source);
    const site = getAliasedValue(raw, ATTRIBUTE_ALIASES.site);
    const siteFinal = getAliasedValue(raw, ATTRIBUTE_ALIASES.siteFinal);
    const pattern = getAliasedValue(raw, ATTRIBUTE_ALIASES.pattern);
    const parentSampleId = getAliasedValue(
        raw,
        ATTRIBUTE_ALIASES.parentSampleId
    );
    const passage = parseExplicitPassage(
        getAliasedValue(raw, ATTRIBUTE_ALIASES.passage)
    );

    const hasGroupingMetadata = Boolean(source || site || siteFinal);

    return {
        studyId: sample.studyId,
        patientId: sample.patientId,
        sampleId: sample.sampleId,
        label,
        clinicalType,
        apiSampleType: sample.sampleType,
        source,
        site,
        siteFinal,
        pattern,
        parentSampleId,
        passage,
        isTumorGraft: isExplicitTumorGraftType(clinicalType),
        provenanceConfidence: parentSampleId
            ? 'explicit-parent'
            : hasGroupingMetadata
            ? 'metadata-grouped'
            : 'unresolved',
        sequenced: Boolean(sample.sequenced),
        copyNumberSegmentPresent: Boolean(sample.copyNumberSegmentPresent),
        raw,
    };
}

function getSourceKey(sample: CanonicalSample) {
    const source = normalizeToken(
        sample.source || sample.siteFinal || 'Unspecified source'
    );
    const site = normalizeToken(sample.site || 'Unspecified site');
    return `${source}::${site}`;
}

function getSourceLabel(sample: CanonicalSample) {
    const source = sample.source || sample.siteFinal || 'Unspecified source';
    return sample.site ? `${source} · ${sample.site}` : source;
}

function classifySampleNode(sample: CanonicalSample): NodeType {
    if (sample.isTumorGraft) return 'tumorgraft';

    const token = normalizeToken(sample.clinicalType);

    if (
        token === 'CL' ||
        token === 'CELL LINE' ||
        token === 'CELLLINE' ||
        token === 'CELL CULTURE'
    ) {
        return 'cellline';
    }

    if (sample.clinicalType) return 'specimen';
    return 'unknown';
}

function isTumorSourceSample(sample: CanonicalSample) {
    if (sample.isTumorGraft) return false;

    const type = normalizeToken(sample.clinicalType);
    const source = normalizeToken(sample.source);

    if (
        type === 'N' ||
        type === 'NORMAL' ||
        type === 'NORMAL TISSUE' ||
        type === 'CL' ||
        type === 'CELL LINE' ||
        type === 'CELLLINE'
    ) {
        return false;
    }

    return (
        type === 'T' ||
        type === 'TUMOR' ||
        type.includes('TUMOR') ||
        source.includes('TUMOR') ||
        source.includes('METASTASIS')
    );
}

function getMutationKey(mutation: MutationRecord) {
    const alternateAllele = mutation.variantAllele || mutation.tumorSeqAllele2;

    if (
        !mutation.chr ||
        mutation.startPosition === undefined ||
        !mutation.referenceAllele ||
        !alternateAllele
    ) {
        return undefined;
    }

    return [
        mutation.chr,
        mutation.startPosition,
        mutation.referenceAllele,
        alternateAllele,
    ].join(':');
}

function compareMutations(
    mutations: MutationRecord[],
    sourceSampleId: string,
    tumorGraftSampleId: string
): MutationComparison {
    const sourceRows = mutations.filter(
        mutation => mutation.sampleId === sourceSampleId
    );
    const tumorGraftRows = mutations.filter(
        mutation => mutation.sampleId === tumorGraftSampleId
    );

    const toComparableMap = (rows: MutationRecord[]) => {
        const map = new Map<string, MutationRecord>();
        let excluded = 0;

        rows.forEach(row => {
            const key = getMutationKey(row);
            if (!key) {
                excluded += 1;
                return;
            }
            if (!map.has(key)) map.set(key, row);
        });

        return { map, excluded };
    };

    const source = toComparableMap(sourceRows);
    const tumorGraft = toComparableMap(tumorGraftRows);

    const sharedKeys = Array.from(source.map.keys()).filter(key =>
        tumorGraft.map.has(key)
    );
    const sourceOnlyKeys = Array.from(source.map.keys()).filter(
        key => !tumorGraft.map.has(key)
    );
    const tumorGraftOnlyKeys = Array.from(tumorGraft.map.keys()).filter(
        key => !source.map.has(key)
    );

    const unionCount = new Set([
        ...Array.from(source.map.keys()),
        ...Array.from(tumorGraft.map.keys()),
    ]).size;

    return {
        sourceComparableCount: source.map.size,
        tumorGraftComparableCount: tumorGraft.map.size,
        sharedCount: sharedKeys.length,
        sourceOnlyCount: sourceOnlyKeys.length,
        tumorGraftOnlyCount: tumorGraftOnlyKeys.length,
        unionCount,
        retention:
            source.map.size > 0 ? sharedKeys.length / source.map.size : 0,
        jaccard: unionCount > 0 ? sharedKeys.length / unionCount : 0,
        excludedSourceCount: source.excluded,
        excludedTumorGraftCount: tumorGraft.excluded,
        shared: sharedKeys.map(key => source.map.get(key)!),
        sourceOnly: sourceOnlyKeys.map(key => source.map.get(key)!),
        tumorGraftOnly: tumorGraftOnlyKeys.map(key => tumorGraft.map.get(key)!),
    };
}

function formatPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

function createSafeExplicitParentMap(samples: CanonicalSample[]) {
    const sampleIds = new Set(samples.map(sample => sample.sampleId));
    const candidateParents = new Map<string, string>();
    const rejected = new Set<string>();

    samples.forEach(sample => {
        if (!sample.parentSampleId) return;

        if (
            sample.parentSampleId === sample.sampleId ||
            !sampleIds.has(sample.parentSampleId)
        ) {
            rejected.add(sample.sampleId);
            return;
        }

        candidateParents.set(sample.sampleId, sample.parentSampleId);
    });

    const hasCycleFrom = (startId: string) => {
        const seen = new Set<string>();
        let current: string | undefined = startId;

        while (current) {
            if (seen.has(current)) return true;
            seen.add(current);
            current = candidateParents.get(current);
        }

        return false;
    };

    Array.from(candidateParents.keys()).forEach(sampleId => {
        if (hasCycleFrom(sampleId)) {
            rejected.add(sampleId);
            candidateParents.delete(sampleId);
        }
    });

    return { parentMap: candidateParents, rejected };
}

function buildProvenanceNodes(patientId: string, samples: CanonicalSample[]) {
    const nodes: ProvenanceNode[] = [
        {
            id: `patient:${patientId}`,
            label: patientId,
            nodeType: 'patient',
            status: 'Selected patient',
            metadata: {
                samples: samples.length,
            },
        },
    ];

    const sourceNodeIds = new Map<string, string>();

    samples.forEach(sample => {
        const sourceKey = getSourceKey(sample);
        if (sourceNodeIds.has(sourceKey)) return;

        const sourceNodeId = `source:${sourceKey}`;
        sourceNodeIds.set(sourceKey, sourceNodeId);

        nodes.push({
            id: sourceNodeId,
            parentId: `patient:${patientId}`,
            label: getSourceLabel(sample),
            nodeType: 'source',
            status: 'Metadata provenance group',
            metadata: {
                groupingBasis: 'SOURCE/SITE metadata',
                source: sample.source || sample.siteFinal || 'Unspecified',
                site: sample.site || 'Unspecified',
            },
        });
    });

    const { parentMap, rejected } = createSafeExplicitParentMap(samples);

    samples.forEach(sample => {
        const explicitParentId = parentMap.get(sample.sampleId);
        const sourceParentId = sourceNodeIds.get(getSourceKey(sample));
        const nodeType = classifySampleNode(sample);
        const hasSafeExplicitParent = Boolean(explicitParentId);

        nodes.push({
            id: `sample:${sample.sampleId}`,
            parentId: hasSafeExplicitParent
                ? `sample:${explicitParentId}`
                : sourceParentId || `patient:${patientId}`,
            label: sample.label,
            nodeType,
            status: hasSafeExplicitParent
                ? 'Explicit parent relationship'
                : rejected.has(sample.sampleId)
                ? 'Invalid parent metadata; grouped by source/site'
                : sample.provenanceConfidence === 'metadata-grouped'
                ? 'Grouped by source/site; ancestry not asserted'
                : 'Provenance unresolved',
            metadata: {
                sampleId: sample.sampleId,
                type: sample.clinicalType || 'Unspecified',
                source: sample.source || 'Unspecified',
                site: sample.site || 'Unspecified',
                siteFinal: sample.siteFinal || 'Unspecified',
                pattern: sample.pattern || 'Unspecified',
                passage:
                    sample.passage !== undefined
                        ? sample.passage
                        : 'Unspecified',
                cBioPortalSampleType: sample.apiSampleType || 'Unspecified',
                mutationSequenced: sample.sequenced,
                copyNumberSegmentPresent: sample.copyNumberSegmentPresent,
                provenanceConfidence: hasSafeExplicitParent
                    ? 'explicit-parent'
                    : sample.provenanceConfidence,
            },
            raw: sample.raw,
        });
    });

    return nodes;
}

function buildTree(nodes: ProvenanceNode[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();

    nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
    });

    const roots: TreeNode[] = [];

    nodeMap.forEach(node => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    const typeOrder: { [key in NodeType]: number } = {
        patient: 0,
        source: 1,
        specimen: 2,
        tumorgraft: 3,
        cellline: 4,
        unknown: 5,
    };

    const sortNode = (node: TreeNode) => {
        node.children.sort((a, b) => {
            const typeDelta = typeOrder[a.nodeType] - typeOrder[b.nodeType];
            if (typeDelta !== 0) return typeDelta;
            return a.label.localeCompare(b.label);
        });
        node.children.forEach(sortNode);
    };

    roots.forEach(sortNode);
    return roots;
}

function getNodeStyle(nodeType: NodeType): React.CSSProperties {
    const base: React.CSSProperties = {
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: '10px 12px',
        minWidth: 210,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    };

    switch (nodeType) {
        case 'patient':
            return { ...base, borderColor: '#286090', background: '#e8f4ff' };
        case 'source':
            return { ...base, borderColor: '#777', background: '#f5f5f5' };
        case 'specimen':
            return { ...base, borderColor: '#5cb85c', background: '#edf8ed' };
        case 'tumorgraft':
            return { ...base, borderColor: '#d9534f', background: '#fcebea' };
        case 'cellline':
            return { ...base, borderColor: '#9467bd', background: '#f4eef9' };
        default:
            return { ...base, borderColor: '#aaa', background: '#fafafa' };
    }
}

function TreeNodeView({
    node,
    selectedNodeId,
    onSelect,
}: {
    node: TreeNode;
    selectedNodeId: string;
    onSelect: (node: TreeNode) => void;
}) {
    const isSelected = selectedNodeId === node.id;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: 12,
            }}
        >
            <button
                type="button"
                onClick={() => onSelect(node)}
                style={{
                    ...getNodeStyle(node.nodeType),
                    cursor: 'pointer',
                    textAlign: 'left',
                    outline: isSelected ? '3px solid #337ab7' : 'none',
                }}
            >
                <div style={{ fontWeight: 700 }}>{node.label}</div>
                <div
                    style={{
                        marginTop: 3,
                        color: '#666',
                        fontSize: 11,
                        textTransform: 'uppercase',
                    }}
                >
                    {node.nodeType === 'tumorgraft'
                        ? 'TumorGraft'
                        : node.nodeType}
                </div>
                {node.status && (
                    <div style={{ marginTop: 4, color: '#555', fontSize: 12 }}>
                        {node.status}
                    </div>
                )}
            </button>

            {node.children.length > 0 && (
                <div
                    style={{
                        marginLeft: 22,
                        paddingLeft: 22,
                        borderLeft: '2px solid #bbb',
                    }}
                >
                    {node.children.map(child => (
                        <div key={child.id} style={{ position: 'relative' }}>
                            <div
                                style={{
                                    position: 'absolute',
                                    left: -22,
                                    top: 26,
                                    width: 22,
                                    borderTop: '2px solid #bbb',
                                }}
                            />
                            <TreeNodeView
                                node={child}
                                selectedNodeId={selectedNodeId}
                                onSelect={onSelect}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function NodeDetails({ node }: { node?: TreeNode }) {
    if (!node) {
        return (
            <div style={{ color: '#777' }}>
                Select a node to inspect its provenance and metadata.
            </div>
        );
    }

    const metadataEntries = Object.entries(node.metadata || {});
    const rawEntries = Object.entries(node.raw || {}).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    return (
        <div>
            <h5 style={{ marginTop: 0 }}>{node.label}</h5>

            <div style={{ marginBottom: 6 }}>
                <strong>Node type:</strong>{' '}
                {node.nodeType === 'tumorgraft' ? 'TumorGraft' : node.nodeType}
            </div>

            {node.status && (
                <div style={{ marginBottom: 10 }}>
                    <strong>Provenance:</strong> {node.status}
                </div>
            )}

            {metadataEntries.map(([key, value]) => (
                <div key={key} style={{ marginBottom: 6 }}>
                    <strong>{key}:</strong> {String(value)}
                </div>
            ))}

            {rawEntries.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div
                        style={{
                            fontWeight: 700,
                            marginBottom: 8,
                            borderTop: '1px solid #eee',
                            paddingTop: 12,
                        }}
                    >
                        Raw clinical attributes
                    </div>
                    {rawEntries.map(([key, value]) => (
                        <div
                            key={key}
                            style={{ marginBottom: 5, fontSize: 12 }}
                        >
                            <strong>{key}:</strong> {value}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, {
        signal,
        credentials: 'same-origin',
    });

    if (!response.ok) {
        const error = new Error(
            `Request failed with HTTP ${response.status}`
        ) as HttpError;
        error.status = response.status;
        throw error;
    }

    return response.json();
}

async function fetchMutationProfile(
    studyId: string,
    signal: AbortSignal
): Promise<MolecularProfile | undefined> {
    const profiles = await fetchJson<MolecularProfile[]>(
        `/api/studies/${encodeURIComponent(
            studyId
        )}/molecular-profiles?projection=DETAILED`,
        signal
    );

    return profiles.find(
        profile =>
            normalizeToken(profile.molecularAlterationType) ===
            'MUTATION EXTENDED'
    );
}

async function fetchMutationsForSamples(
    molecularProfileId: string,
    sampleIds: string[],
    signal: AbortSignal
) {
    const response = await fetch(
        `/api/molecular-profiles/${encodeURIComponent(
            molecularProfileId
        )}/mutations/fetch?projection=DETAILED`,
        {
            method: 'POST',
            credentials: 'same-origin',
            signal,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ sampleIds }),
        }
    );

    if (!response.ok) {
        const error = new Error(
            `Mutation request failed with HTTP ${response.status}`
        ) as HttpError;
        error.status = response.status;
        throw error;
    }

    return response.json() as Promise<MutationRecord[]>;
}

async function fetchPatientSamples(
    studyId: string,
    patientId: string,
    signal: AbortSignal
) {
    return fetchJson<ApiSample[]>(
        `/api/studies/${encodeURIComponent(
            studyId
        )}/patients/${encodeURIComponent(
            patientId
        )}/samples?projection=DETAILED`,
        signal
    );
}

async function fetchClinicalDataPerSample(
    studyId: string,
    samples: ApiSample[],
    signal: AbortSignal
) {
    const results = await Promise.all(
        samples.map(async sample => {
            const rows = await fetchJson<ClinicalDataRow[]>(
                `/api/studies/${encodeURIComponent(
                    studyId
                )}/samples/${encodeURIComponent(
                    sample.sampleId
                )}/clinical-data?projection=DETAILED`,
                signal
            );

            return {
                sampleId: sample.sampleId,
                raw: rowsToRawAttributes(rows),
            };
        })
    );

    return new Map(results.map(result => [result.sampleId, result.raw]));
}

async function fetchClinicalDataStudyFallback(
    studyId: string,
    samples: ApiSample[],
    signal: AbortSignal
) {
    const sampleIds = new Set(samples.map(sample => sample.sampleId));
    const rows = await fetchJson<ClinicalDataRow[]>(
        `/api/studies/${encodeURIComponent(
            studyId
        )}/clinical-data?clinicalDataType=SAMPLE&projection=DETAILED`,
        signal
    );

    const grouped = new Map<string, ClinicalDataRow[]>();

    rows.forEach(row => {
        if (!row.sampleId || !sampleIds.has(row.sampleId)) return;
        if (!grouped.has(row.sampleId)) grouped.set(row.sampleId, []);
        grouped.get(row.sampleId)!.push(row);
    });

    const result = new Map<string, RawAttributes>();
    samples.forEach(sample => {
        result.set(
            sample.sampleId,
            rowsToRawAttributes(grouped.get(sample.sampleId) || [])
        );
    });

    return result;
}

export default function TumorGraftLineage({ studyId, patientId }: Props) {
    const [samples, setSamples] = React.useState<CanonicalSample[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [selectedNodeId, setSelectedNodeId] = React.useState('');
    const [usedStudyFallback, setUsedStudyFallback] = React.useState(false);
    const [selectedSourceSampleId, setSelectedSourceSampleId] = React.useState(
        ''
    );
    const [
        selectedTumorGraftSampleId,
        setSelectedTumorGraftSampleId,
    ] = React.useState('');
    const [mutationComparison, setMutationComparison] = React.useState<
        MutationComparison | undefined
    >(undefined);
    const [mutationProfileId, setMutationProfileId] = React.useState('');
    const [
        loadingMutationComparison,
        setLoadingMutationComparison,
    ] = React.useState(false);
    const [mutationError, setMutationError] = React.useState('');
    const [mutationView, setMutationView] = React.useState<MutationView>(
        'shared'
    );

    React.useEffect(() => {
        if (!studyId || !patientId) {
            setSamples([]);
            return;
        }

        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError('');
            setSelectedNodeId('');
            setUsedStudyFallback(false);

            try {
                const apiSamples = await fetchPatientSamples(
                    studyId,
                    patientId,
                    controller.signal
                );

                let clinicalBySample: Map<string, RawAttributes>;

                try {
                    clinicalBySample = await fetchClinicalDataPerSample(
                        studyId,
                        apiSamples,
                        controller.signal
                    );
                } catch (err) {
                    const typedError = err as HttpError;
                    const fallbackStatuses = [404, 405, 501];

                    if (
                        !typedError.status ||
                        !fallbackStatuses.includes(typedError.status)
                    ) {
                        throw err;
                    }

                    clinicalBySample = await fetchClinicalDataStudyFallback(
                        studyId,
                        apiSamples,
                        controller.signal
                    );
                    setUsedStudyFallback(true);
                }

                const normalized = apiSamples
                    .map(sample =>
                        normalizeSample(
                            sample,
                            clinicalBySample.get(sample.sampleId) || {}
                        )
                    )
                    .sort((a, b) => a.label.localeCompare(b.label));

                setSamples(normalized);
            } catch (err) {
                const typedError = err as Error;
                if (typedError.name === 'AbortError') return;

                setSamples([]);
                setError(
                    typedError.message ||
                        'Could not load TumorGraft provenance data.'
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        load();
        return () => controller.abort();
    }, [studyId, patientId]);

    const sourceSamples = React.useMemo(
        () => samples.filter(isTumorSourceSample),
        [samples]
    );
    const tumorGraftSamples = React.useMemo(
        () => samples.filter(sample => sample.isTumorGraft),
        [samples]
    );

    React.useEffect(() => {
        if (sourceSamples.length === 0 || tumorGraftSamples.length === 0) {
            setSelectedSourceSampleId('');
            setSelectedTumorGraftSampleId('');
            return;
        }

        const firstTumorGraft = tumorGraftSamples[0];
        const sameGroupSource = sourceSamples.find(
            sample => getSourceKey(sample) === getSourceKey(firstTumorGraft)
        );

        setSelectedTumorGraftSampleId(firstTumorGraft.sampleId);
        setSelectedSourceSampleId(
            (sameGroupSource || sourceSamples[0]).sampleId
        );
    }, [sourceSamples, tumorGraftSamples]);

    React.useEffect(() => {
        if (!selectedSourceSampleId || !selectedTumorGraftSampleId) {
            setMutationComparison(undefined);
            setMutationProfileId('');
            setMutationError('');
            return;
        }

        const controller = new AbortController();

        async function loadMutationComparison() {
            setLoadingMutationComparison(true);
            setMutationError('');
            setMutationComparison(undefined);

            try {
                const profile = await fetchMutationProfile(
                    studyId,
                    controller.signal
                );

                if (!profile) {
                    setMutationProfileId('');
                    setMutationError(
                        'No mutation molecular profile is available for this study.'
                    );
                    return;
                }

                setMutationProfileId(profile.molecularProfileId);

                const mutations = await fetchMutationsForSamples(
                    profile.molecularProfileId,
                    [selectedSourceSampleId, selectedTumorGraftSampleId],
                    controller.signal
                );

                setMutationComparison(
                    compareMutations(
                        mutations,
                        selectedSourceSampleId,
                        selectedTumorGraftSampleId
                    )
                );
            } catch (err) {
                const typedError = err as Error;
                if (typedError.name === 'AbortError') return;
                setMutationError(
                    typedError.message || 'Could not compare mutation profiles.'
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingMutationComparison(false);
                }
            }
        }

        loadMutationComparison();
        return () => controller.abort();
    }, [studyId, selectedSourceSampleId, selectedTumorGraftSampleId]);

    const selectedSourceSample = sourceSamples.find(
        sample => sample.sampleId === selectedSourceSampleId
    );
    const selectedTumorGraftSample = tumorGraftSamples.find(
        sample => sample.sampleId === selectedTumorGraftSampleId
    );

    const comparisonRelationship =
        selectedSourceSample && selectedTumorGraftSample
            ? selectedTumorGraftSample.parentSampleId ===
              selectedSourceSample.sampleId
                ? 'explicit-lineage'
                : getSourceKey(selectedSourceSample) ===
                  getSourceKey(selectedTumorGraftSample)
                ? 'metadata-associated'
                : 'cross-provenance'
            : undefined;

    const handleNodeSelect = (node: TreeNode) => {
        setSelectedNodeId(node.id);

        const sampleId = node.metadata?.sampleId;
        if (typeof sampleId !== 'string') return;

        const sample = samples.find(
            candidate => candidate.sampleId === sampleId
        );
        if (!sample) return;

        if (sample.isTumorGraft) {
            setSelectedTumorGraftSampleId(sample.sampleId);
            const sameGroupSource = sourceSamples.find(
                candidate => getSourceKey(candidate) === getSourceKey(sample)
            );
            if (sameGroupSource) {
                setSelectedSourceSampleId(sameGroupSource.sampleId);
            }
            return;
        }

        if (isTumorSourceSample(sample)) {
            setSelectedSourceSampleId(sample.sampleId);
            const sameGroupTumorGraft = tumorGraftSamples.find(
                candidate => getSourceKey(candidate) === getSourceKey(sample)
            );
            if (sameGroupTumorGraft) {
                setSelectedTumorGraftSampleId(sameGroupTumorGraft.sampleId);
            }
        }
    };

    const mutationRows = mutationComparison
        ? mutationView === 'shared'
            ? mutationComparison.shared
            : mutationView === 'source-only'
            ? mutationComparison.sourceOnly
            : mutationComparison.tumorGraftOnly
        : [];

    const nodes = React.useMemo(
        () => buildProvenanceNodes(patientId, samples),
        [patientId, samples]
    );
    const roots = React.useMemo(() => buildTree(nodes), [nodes]);
    const selectedNode = nodes.find(node => node.id === selectedNodeId) as
        | TreeNode
        | undefined;

    const tumorGraftCount = samples.filter(sample => sample.isTumorGraft)
        .length;
    const sourceGroupCount = new Set(samples.map(getSourceKey)).size;
    const explicitParentCount = samples.filter(
        sample => sample.provenanceConfidence === 'explicit-parent'
    ).length;
    const unresolvedCount = samples.filter(
        sample => sample.provenanceConfidence === 'unresolved'
    ).length;

    return (
        <div>
            <h4>TumorGraft Provenance</h4>

            <p style={{ color: '#666', maxWidth: 980 }}>
                Displays real patient, specimen, and TumorGraft provenance from
                sample-level clinical metadata. Exact ancestry is shown only
                when an explicit parent-sample field exists; otherwise samples
                are grouped by source and anatomic site without asserting
                passage relationships.
            </p>

            {error && <div className="alert alert-danger">{error}</div>}

            {usedStudyFallback && (
                <div className="alert alert-warning">
                    This cBioPortal build did not expose per-sample
                    clinical-data retrieval, so the tool used the study-level
                    compatibility endpoint and filtered the response to this
                    patient.
                </div>
            )}

            {loading && <div>Loading TumorGraft provenance...</div>}

            {!loading && !error && samples.length === 0 && (
                <div className="alert alert-info">
                    No sample records are available for this patient.
                </div>
            )}

            {!loading && !error && samples.length > 0 && (
                <div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'repeat(auto-fit, minmax(170px, 1fr))',
                            gap: 12,
                            marginBottom: 18,
                        }}
                    >
                        {[
                            ['Patient samples', samples.length],
                            ['TumorGrafts', tumorGraftCount],
                            ['Source groups', sourceGroupCount],
                            ['Explicit parent links', explicitParentCount],
                        ].map(([label, value]) => (
                            <div
                                key={String(label)}
                                style={{
                                    border: '1px solid #ddd',
                                    borderRadius: 6,
                                    padding: 12,
                                    background: '#fff',
                                }}
                            >
                                <div style={{ color: '#666', fontSize: 12 }}>
                                    {label}
                                </div>
                                <strong style={{ fontSize: 20 }}>
                                    {value}
                                </strong>
                            </div>
                        ))}
                    </div>

                    <div
                        className="alert alert-info"
                        style={{ marginBottom: 18 }}
                    >
                        <strong>Provenance policy:</strong>{' '}
                        {explicitParentCount > 0
                            ? `${explicitParentCount} sample relationship(s) are backed by explicit parent metadata. Other samples are grouped by source/site only.`
                            : 'No explicit parent-sample relationships were found. The tree below is a metadata provenance view, not a claim of passage-to-passage ancestry.'}
                        {unresolvedCount > 0
                            ? ` ${unresolvedCount} sample(s) lack enough metadata for source/site grouping.`
                            : ''}
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'minmax(560px, 2fr) minmax(280px, 1fr)',
                            gap: 20,
                            alignItems: 'start',
                        }}
                    >
                        <div
                            style={{
                                overflowX: 'auto',
                                border: '1px solid #ddd',
                                borderRadius: 6,
                                padding: 20,
                                background: '#fafafa',
                            }}
                        >
                            {roots.map(root => (
                                <TreeNodeView
                                    key={root.id}
                                    node={root}
                                    selectedNodeId={selectedNodeId}
                                    onSelect={handleNodeSelect}
                                />
                            ))}
                        </div>

                        <div
                            style={{
                                border: '1px solid #ddd',
                                borderRadius: 6,
                                padding: 16,
                                background: '#fff',
                                maxHeight: 720,
                                overflowY: 'auto',
                            }}
                        >
                            <h4 style={{ marginTop: 0, fontSize: 16 }}>
                                Node Details
                            </h4>
                            <NodeDetails node={selectedNode} />
                        </div>
                    </div>

                    <div
                        style={{
                            marginTop: 24,
                            border: '1px solid #cfcfcf',
                            borderRadius: 6,
                            background: '#fff',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '16px 18px',
                                borderBottom: '1px solid #ddd',
                                background: '#f7f7f7',
                            }}
                        >
                            <h4 style={{ margin: 0 }}>Molecular Fidelity</h4>
                            <div style={{ color: '#666', marginTop: 5 }}>
                                Compares exact genomic mutation identities
                                between a source tumor and TumorGraft. Metrics
                                are descriptive concordance measures and do not
                                establish clonal ancestry.
                            </div>
                        </div>

                        <div style={{ padding: 18 }}>
                            {sourceSamples.length === 0 ||
                            tumorGraftSamples.length === 0 ? (
                                <div
                                    className="alert alert-info"
                                    style={{ margin: 0 }}
                                >
                                    This patient does not have both a
                                    recognizable tumor specimen and TumorGraft
                                    available for molecular comparison.
                                </div>
                            ) : (
                                <div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 16,
                                            flexWrap: 'wrap',
                                            alignItems: 'flex-end',
                                            marginBottom: 16,
                                        }}
                                    >
                                        <div>
                                            <label>Source tumor</label>
                                            <select
                                                className="form-control"
                                                value={selectedSourceSampleId}
                                                onChange={event =>
                                                    setSelectedSourceSampleId(
                                                        event.target.value
                                                    )
                                                }
                                                style={{ minWidth: 290 }}
                                            >
                                                {sourceSamples.map(sample => (
                                                    <option
                                                        key={sample.sampleId}
                                                        value={sample.sampleId}
                                                    >
                                                        {sample.label} —{' '}
                                                        {getSourceLabel(sample)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label>TumorGraft</label>
                                            <select
                                                className="form-control"
                                                value={
                                                    selectedTumorGraftSampleId
                                                }
                                                onChange={event =>
                                                    setSelectedTumorGraftSampleId(
                                                        event.target.value
                                                    )
                                                }
                                                style={{ minWidth: 290 }}
                                            >
                                                {tumorGraftSamples.map(
                                                    sample => (
                                                        <option
                                                            key={
                                                                sample.sampleId
                                                            }
                                                            value={
                                                                sample.sampleId
                                                            }
                                                        >
                                                            {sample.label} —{' '}
                                                            {getSourceLabel(
                                                                sample
                                                            )}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    {comparisonRelationship ===
                                        'metadata-associated' && (
                                        <div className="alert alert-info">
                                            <strong>
                                                Metadata-associated comparison.
                                            </strong>{' '}
                                            These samples share source/anatomic
                                            provenance, but the dataset does not
                                            assert a direct parent-child
                                            relationship.
                                        </div>
                                    )}

                                    {comparisonRelationship ===
                                        'explicit-lineage' && (
                                        <div className="alert alert-success">
                                            <strong>
                                                Explicit lineage comparison.
                                            </strong>{' '}
                                            The TumorGraft identifies the
                                            selected tumor as its parent sample.
                                        </div>
                                    )}

                                    {comparisonRelationship ===
                                        'cross-provenance' && (
                                        <div className="alert alert-warning">
                                            <strong>
                                                Cross-provenance comparison.
                                            </strong>{' '}
                                            The selected samples belong to
                                            different source/site groups.
                                            Interpret molecular similarity
                                            independently of provenance.
                                        </div>
                                    )}

                                    {loadingMutationComparison && (
                                        <div>Loading mutation fidelity...</div>
                                    )}

                                    {mutationError && (
                                        <div className="alert alert-danger">
                                            {mutationError}
                                        </div>
                                    )}

                                    {!loadingMutationComparison &&
                                        mutationComparison && (
                                            <div>
                                                <div
                                                    style={{
                                                        color: '#777',
                                                        fontSize: 12,
                                                        marginBottom: 12,
                                                    }}
                                                >
                                                    Mutation profile:{' '}
                                                    <code>
                                                        {mutationProfileId}
                                                    </code>{' '}
                                                    · Matching key: chromosome +
                                                    start position + reference
                                                    allele + alternate allele
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns:
                                                            'repeat(auto-fit, minmax(150px, 1fr))',
                                                        gap: 10,
                                                        marginBottom: 18,
                                                    }}
                                                >
                                                    {[
                                                        [
                                                            'Source variants',
                                                            mutationComparison.sourceComparableCount,
                                                        ],
                                                        [
                                                            'TumorGraft variants',
                                                            mutationComparison.tumorGraftComparableCount,
                                                        ],
                                                        [
                                                            'Shared variants',
                                                            mutationComparison.sharedCount,
                                                        ],
                                                        [
                                                            'Source-only',
                                                            mutationComparison.sourceOnlyCount,
                                                        ],
                                                        [
                                                            'TumorGraft-only',
                                                            mutationComparison.tumorGraftOnlyCount,
                                                        ],
                                                        [
                                                            'Mutation retention',
                                                            formatPercent(
                                                                mutationComparison.retention
                                                            ),
                                                        ],
                                                        [
                                                            'Jaccard similarity',
                                                            formatPercent(
                                                                mutationComparison.jaccard
                                                            ),
                                                        ],
                                                    ].map(([label, value]) => (
                                                        <div
                                                            key={String(label)}
                                                            style={{
                                                                border:
                                                                    '1px solid #ddd',
                                                                borderRadius: 6,
                                                                padding: 12,
                                                                background:
                                                                    '#fafafa',
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    color:
                                                                        '#666',
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                {label}
                                                            </div>
                                                            <strong
                                                                style={{
                                                                    fontSize: 20,
                                                                }}
                                                            >
                                                                {value}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>

                                                {(mutationComparison.excludedSourceCount >
                                                    0 ||
                                                    mutationComparison.excludedTumorGraftCount >
                                                        0) && (
                                                    <div className="alert alert-warning">
                                                        Some mutation records
                                                        lacked complete genomic
                                                        identity and were
                                                        excluded from
                                                        concordance metrics:
                                                        source{' '}
                                                        {
                                                            mutationComparison.excludedSourceCount
                                                        }
                                                        , TumorGraft{' '}
                                                        {
                                                            mutationComparison.excludedTumorGraftCount
                                                        }
                                                        .
                                                    </div>
                                                )}

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: 8,
                                                        marginBottom: 12,
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${
                                                            mutationView ===
                                                            'shared'
                                                                ? 'btn-primary'
                                                                : 'btn-default'
                                                        }`}
                                                        onClick={() =>
                                                            setMutationView(
                                                                'shared'
                                                            )
                                                        }
                                                    >
                                                        Shared (
                                                        {
                                                            mutationComparison.sharedCount
                                                        }
                                                        )
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${
                                                            mutationView ===
                                                            'source-only'
                                                                ? 'btn-primary'
                                                                : 'btn-default'
                                                        }`}
                                                        onClick={() =>
                                                            setMutationView(
                                                                'source-only'
                                                            )
                                                        }
                                                    >
                                                        Source-only (
                                                        {
                                                            mutationComparison.sourceOnlyCount
                                                        }
                                                        )
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${
                                                            mutationView ===
                                                            'tumorgraft-only'
                                                                ? 'btn-primary'
                                                                : 'btn-default'
                                                        }`}
                                                        onClick={() =>
                                                            setMutationView(
                                                                'tumorgraft-only'
                                                            )
                                                        }
                                                    >
                                                        TumorGraft-only (
                                                        {
                                                            mutationComparison.tumorGraftOnlyCount
                                                        }
                                                        )
                                                    </button>
                                                </div>

                                                <div
                                                    style={{
                                                        border:
                                                            '1px solid #ddd',
                                                        borderRadius: 6,
                                                        overflowX: 'auto',
                                                    }}
                                                >
                                                    <table
                                                        className="table table-striped table-condensed"
                                                        style={{
                                                            marginBottom: 0,
                                                        }}
                                                    >
                                                        <thead>
                                                            <tr>
                                                                <th>Gene</th>
                                                                <th>
                                                                    Protein
                                                                    change
                                                                </th>
                                                                <th>
                                                                    Genomic
                                                                    variant
                                                                </th>
                                                                <th>Type</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {mutationRows.map(
                                                                (
                                                                    mutation,
                                                                    index
                                                                ) => {
                                                                    const alternateAllele =
                                                                        mutation.variantAllele ||
                                                                        mutation.tumorSeqAllele2 ||
                                                                        '?';

                                                                    return (
                                                                        <tr
                                                                            key={`${getMutationKey(
                                                                                mutation
                                                                            )}-${index}`}
                                                                        >
                                                                            <td>
                                                                                <strong>
                                                                                    {mutation
                                                                                        .gene
                                                                                        ?.hugoGeneSymbol ||
                                                                                        'Unknown'}
                                                                                </strong>
                                                                            </td>
                                                                            <td>
                                                                                {mutation.proteinChange ||
                                                                                    '—'}
                                                                            </td>
                                                                            <td>
                                                                                chr
                                                                                {mutation.chr ||
                                                                                    '?'}

                                                                                :
                                                                                {mutation.startPosition ??
                                                                                    '?'}{' '}
                                                                                {mutation.referenceAllele ||
                                                                                    '?'}

                                                                                →
                                                                                {
                                                                                    alternateAllele
                                                                                }
                                                                            </td>
                                                                            <td>
                                                                                {mutation.variantType ||
                                                                                    mutation.mutationType ||
                                                                                    '—'}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }
                                                            )}
                                                        </tbody>
                                                    </table>

                                                    {mutationRows.length ===
                                                        0 && (
                                                        <div
                                                            style={{
                                                                padding: 16,
                                                                color: '#777',
                                                            }}
                                                        >
                                                            No variants in this
                                                            category.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
