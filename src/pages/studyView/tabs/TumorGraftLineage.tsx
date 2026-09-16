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
                                    onSelect={node =>
                                        setSelectedNodeId(node.id)
                                    }
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
                </div>
            )}
        </div>
    );
}
