import * as React from 'react';
import { Button, FormControl } from 'react-bootstrap';

type Props = {
    studyId: string;
};

type Patient = {
    patientId: string;
};

type ClinicalEvent = {
    patientId?: string;
    eventType?: string;
    eventTypeDetailed?: string;
    startNumberOfDaysSinceDiagnosis?: number;
    stopNumberOfDaysSinceDiagnosis?: number;
    startDate?: number;
    stopDate?: number;
    START_DATE?: number;
    STOP_DATE?: number;
    EVENT_TYPE?: string;
    EVENT_TYPE_DETAILED?: string;
    attributes?: Array<{
        key?: string;
        attributeId?: string;
        value?: string;
    }>;
    [key: string]: any;
};

type ResearchToolView = 'inventory' | 'tumorgraph' | 'assistant';

type TumorGraphNodeType =
    | 'patient'
    | 'specimen'
    | 'tumorgraph'
    | 'passage'
    | 'organoid'
    | 'assay';

type TumorGraphNode = {
    id: string;
    parentId?: string;
    label: string;
    nodeType: TumorGraphNodeType;
    passage?: number;
    status?: string;
    collectionDay?: number;
    metadata?: {
        [key: string]: string | number | boolean | undefined;
    };
};

type TreeNode = TumorGraphNode & {
    children: TreeNode[];
};

function getEventDay(event: ClinicalEvent) {
    return (
        event.startNumberOfDaysSinceDiagnosis ??
        event.startDate ??
        event.START_DATE ??
        0
    );
}

function getStopDay(event: ClinicalEvent) {
    return (
        event.stopNumberOfDaysSinceDiagnosis ??
        event.stopDate ??
        event.STOP_DATE ??
        undefined
    );
}

function getEventType(event: ClinicalEvent) {
    return event.eventType ?? event.EVENT_TYPE ?? 'Event';
}

function getDetailedType(event: ClinicalEvent) {
    return (
        event.eventTypeDetailed ??
        event.EVENT_TYPE_DETAILED ??
        getAttributeValue(event, 'EVENT_TYPE_DETAILED') ??
        ''
    );
}

function getAttributeValue(event: ClinicalEvent, key: string) {
    const attrs = event.attributes || [];
    const lowerKey = key.toLowerCase();

    const match = attrs.find(attr => {
        const attributeKey = attr.key || attr.attributeId || '';
        return attributeKey.toLowerCase() === lowerKey;
    });

    return match?.value;
}

function getEventTitle(event: ClinicalEvent) {
    const eventType = getEventType(event);
    const detailed = getDetailedType(event);

    if (eventType === 'Specimen') {
        return getAttributeValue(event, 'SAMPLE_ID') || 'Specimen collected';
    }

    if (eventType === 'Treatment') {
        const agent = getAttributeValue(event, 'AGENT');
        const subtype = getAttributeValue(event, 'SUBTYPE');
        return [subtype, agent].filter(Boolean).join(': ') || 'Treatment';
    }

    if (eventType === 'Status') {
        return getAttributeValue(event, 'STATUS') || detailed || 'Status';
    }

    if (eventType === 'Surgery') {
        return detailed || getAttributeValue(event, 'SURGERY') || 'Surgery';
    }

    return detailed || eventType;
}

function getUsefulDetails(event: ClinicalEvent) {
    return (event.attributes || [])
        .filter(
            attribute => attribute.value !== undefined && attribute.value !== ''
        )
        .map(attribute => ({
            key: attribute.key || attribute.attributeId || 'Attribute',
            value: attribute.value || '',
        }));
}

function inferSampleCategory(sampleId: string) {
    if (!sampleId) return 'Unknown';

    if (sampleId.includes('Th')) return 'Thrombus';
    if (sampleId.includes('M')) return 'Metastasis';
    if (sampleId.includes('N')) return 'Normal';
    if (sampleId.includes('T')) return 'Primary tumor';

    return 'Specimen';
}

/*
 * These values are temporary display inferences.
 * Replace them with real inventory metadata once that table is available.
 */
function inferAssays(sampleId: string, eventType: string) {
    const isSpecimen = eventType === 'Specimen';

    return {
        rnaSeq: isSpecimen,
        wes:
            isSpecimen &&
            (sampleId.startsWith('XP1') || sampleId.startsWith('XP2')),
        freshFrozen: isSpecimen,
        dmso: false,
        tumorgraph: false,
        organoid: false,
    };
}

function getBadgeStyle(eventType: string): React.CSSProperties {
    const base: React.CSSProperties = {
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 700,
        marginRight: 8,
    };

    if (eventType === 'Specimen') {
        return { ...base, background: '#e8f4ff', color: '#1f77b4' };
    }

    if (eventType === 'Treatment') {
        return { ...base, background: '#fff3cd', color: '#8a6d00' };
    }

    if (eventType === 'Surgery') {
        return { ...base, background: '#e8f5e9', color: '#2e7d32' };
    }

    if (eventType === 'Status') {
        return { ...base, background: '#fce4ec', color: '#ad1457' };
    }

    return { ...base, background: '#eee', color: '#444' };
}

function getTumorGraphNodeStyle(
    nodeType: TumorGraphNodeType
): React.CSSProperties {
    const base: React.CSSProperties = {
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: '10px 12px',
        minWidth: 180,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    };

    switch (nodeType) {
        case 'patient':
            return {
                ...base,
                borderColor: '#286090',
                background: '#e8f4ff',
            };
        case 'specimen':
            return {
                ...base,
                borderColor: '#5cb85c',
                background: '#edf8ed',
            };
        case 'tumorgraph':
            return {
                ...base,
                borderColor: '#d9534f',
                background: '#fcebea',
            };
        case 'passage':
            return {
                ...base,
                borderColor: '#f0ad4e',
                background: '#fff7e6',
            };
        case 'organoid':
            return {
                ...base,
                borderColor: '#9467bd',
                background: '#f4eef9',
            };
        case 'assay':
            return {
                ...base,
                borderColor: '#5bc0de',
                background: '#eaf8fb',
            };
        default:
            return base;
    }
}

function buildTree(nodes: TumorGraphNode[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();

    nodes.forEach(node => {
        nodeMap.set(node.id, {
            ...node,
            children: [],
        });
    });

    const roots: TreeNode[] = [];

    nodeMap.forEach(node => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortTree = (treeNode: TreeNode) => {
        treeNode.children.sort((a, b) => {
            const aPassage = a.passage ?? -1;
            const bPassage = b.passage ?? -1;

            if (aPassage !== bPassage) {
                return aPassage - bPassage;
            }

            return a.label.localeCompare(b.label);
        });

        treeNode.children.forEach(sortTree);
    };

    roots.forEach(sortTree);
    return roots;
}

function getMaximumPassage(nodes: TumorGraphNode[]) {
    return nodes.reduce(
        (maximum, node) => Math.max(maximum, node.passage ?? 0),
        0
    );
}

function isStableTumorGraphLine(nodes: TumorGraphNode[]) {
    /*
     * Current prototype rule:
     * a line is considered stable once it progresses beyond passage 2.
     * This can be changed when Dr. Xie's final definition is confirmed.
     */
    return getMaximumPassage(nodes) > 2;
}

function buildDemoTumorGraphNodes(
    patientId: string,
    specimenId: string
): TumorGraphNode[] {
    const patientNodeId = `patient-${patientId}`;
    const specimenNodeId = `specimen-${specimenId}`;

    return [
        {
            id: patientNodeId,
            label: patientId,
            nodeType: 'patient',
            status: 'Selected patient',
        },
        {
            id: specimenNodeId,
            parentId: patientNodeId,
            label: specimenId,
            nodeType: 'specimen',
            collectionDay: 0,
            metadata: {
                sampleType: inferSampleCategory(specimenId),
            },
        },
        {
            id: `${specimenId}-tg-p0`,
            parentId: specimenNodeId,
            label: `${specimenId} TumorGraph P0`,
            nodeType: 'tumorgraph',
            passage: 0,
            status: 'Established',
        },
        {
            id: `${specimenId}-tg-p1a`,
            parentId: `${specimenId}-tg-p0`,
            label: `${specimenId} P1-A`,
            nodeType: 'passage',
            passage: 1,
            status: 'Viable',
        },
        {
            id: `${specimenId}-tg-p1b`,
            parentId: `${specimenId}-tg-p0`,
            label: `${specimenId} P1-B`,
            nodeType: 'passage',
            passage: 1,
            status: 'Viable',
        },
        {
            id: `${specimenId}-tg-p2`,
            parentId: `${specimenId}-tg-p1a`,
            label: `${specimenId} P2`,
            nodeType: 'passage',
            passage: 2,
            status: 'Viable',
        },
        {
            id: `${specimenId}-tg-p3`,
            parentId: `${specimenId}-tg-p2`,
            label: `${specimenId} P3`,
            nodeType: 'passage',
            passage: 3,
            status: 'Stable line',
        },
        {
            id: `${specimenId}-organoid`,
            parentId: specimenNodeId,
            label: `${specimenId} Organoid`,
            nodeType: 'organoid',
            status: 'Derived model',
        },
        {
            id: `${specimenId}-rna`,
            parentId: specimenNodeId,
            label: `${specimenId} RNA-seq`,
            nodeType: 'assay',
            status: 'Sequenced',
        },
    ];
}

function TumorGraphTreeNode({
    node,
    selectedNodeId,
    onSelectNode,
}: {
    node: TreeNode;
    selectedNodeId: string;
    onSelectNode: (node: TreeNode) => void;
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
                onClick={() => onSelectNode(node)}
                style={{
                    ...getTumorGraphNodeStyle(node.nodeType),
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
                    {node.nodeType}
                    {node.passage !== undefined
                        ? ` · Passage ${node.passage}`
                        : ''}
                </div>

                {node.status && (
                    <div
                        style={{
                            marginTop: 4,
                            color: '#555',
                            fontSize: 12,
                        }}
                    >
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
                        <div
                            key={child.id}
                            style={{
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    left: -22,
                                    top: 26,
                                    width: 22,
                                    borderTop: '2px solid #bbb',
                                }}
                            />

                            <TumorGraphTreeNode
                                node={child}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={onSelectNode}
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
                Select a node to inspect its details.
            </div>
        );
    }

    const metadataEntries = Object.entries(node.metadata || {});

    return (
        <div>
            <h5 style={{ marginTop: 0 }}>{node.label}</h5>

            <div style={{ marginBottom: 6 }}>
                <strong>Node type:</strong> {node.nodeType}
            </div>

            {node.passage !== undefined && (
                <div style={{ marginBottom: 6 }}>
                    <strong>Passage:</strong> P{node.passage}
                </div>
            )}

            {node.collectionDay !== undefined && (
                <div style={{ marginBottom: 6 }}>
                    <strong>Collection day:</strong> {node.collectionDay}
                </div>
            )}

            {node.status && (
                <div style={{ marginBottom: 6 }}>
                    <strong>Status:</strong> {node.status}
                </div>
            )}

            {node.parentId && (
                <div style={{ marginBottom: 6 }}>
                    <strong>Parent node:</strong> {node.parentId}
                </div>
            )}

            {metadataEntries.map(([key, value]) => (
                <div key={key} style={{ marginBottom: 6 }}>
                    <strong>{key}:</strong> {String(value)}
                </div>
            ))}
        </div>
    );
}

export default function PatientTimelineTab({ studyId }: Props) {
    const [activeView, setActiveView] = React.useState<ResearchToolView>(
        'inventory'
    );
    const [patients, setPatients] = React.useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = React.useState('');
    const [events, setEvents] = React.useState<ClinicalEvent[]>([]);
    const [loadingPatients, setLoadingPatients] = React.useState(false);
    const [loadingEvents, setLoadingEvents] = React.useState(false);
    const [showDay0SpecimensOnly, setShowDay0SpecimensOnly] = React.useState(
        false
    );
    const [showDemoTumorGraph, setShowDemoTumorGraph] = React.useState(false);
    const [selectedSpecimenId, setSelectedSpecimenId] = React.useState('');
    const [
        selectedTumorGraphNodeId,
        setSelectedTumorGraphNodeId,
    ] = React.useState('');
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        async function loadPatients() {
            setLoadingPatients(true);
            setError('');

            try {
                const response = await fetch(
                    `/api/studies/${studyId}/patients?projection=SUMMARY`
                );

                if (!response.ok) {
                    throw new Error(
                        `Could not load patients: ${response.status}`
                    );
                }

                const data = await response.json();

                const sortedPatients = data
                    .map((patient: any) => ({
                        patientId: patient.patientId,
                    }))
                    .sort((a: Patient, b: Patient) =>
                        a.patientId.localeCompare(b.patientId)
                    );

                setPatients(sortedPatients);

                if (sortedPatients.length > 0) {
                    setSelectedPatientId(sortedPatients[0].patientId);
                }
            } catch (err) {
                setError(err.message || 'Could not load patients.');
            } finally {
                setLoadingPatients(false);
            }
        }

        if (studyId) {
            loadPatients();
        }
    }, [studyId]);

    React.useEffect(() => {
        async function loadEvents() {
            if (!selectedPatientId) {
                return;
            }

            setLoadingEvents(true);
            setError('');

            try {
                const response = await fetch(
                    `/api/studies/${studyId}/patients/${selectedPatientId}/clinical-events`
                );

                if (!response.ok) {
                    throw new Error(
                        `Could not load clinical events: ${response.status}`
                    );
                }

                const data = await response.json();

                const sortedEvents = data.sort(
                    (a: ClinicalEvent, b: ClinicalEvent) =>
                        getEventDay(a) - getEventDay(b)
                );

                setEvents(sortedEvents);
                setSelectedTumorGraphNodeId('');
            } catch (err) {
                setError(err.message || 'Could not load patient events.');
                setEvents([]);
            } finally {
                setLoadingEvents(false);
            }
        }

        loadEvents();
    }, [studyId, selectedPatientId]);

    const specimenEvents = events.filter(
        event => getEventType(event) === 'Specimen'
    );

    const specimenIds = Array.from(
        new Set(
            specimenEvents
                .map(event => getAttributeValue(event, 'SAMPLE_ID'))
                .filter((sampleId): sampleId is string => Boolean(sampleId))
        )
    ).sort();

    React.useEffect(() => {
        if (specimenIds.length === 0) {
            setSelectedSpecimenId('');
            return;
        }

        if (!specimenIds.includes(selectedSpecimenId)) {
            setSelectedSpecimenId(specimenIds[0]);
        }
    }, [selectedPatientId, specimenIds.join('|')]);

    const inventoryEvents = showDay0SpecimensOnly
        ? events.filter(
              event =>
                  getEventType(event) === 'Specimen' && getEventDay(event) === 0
          )
        : events;

    const groupedByDay = inventoryEvents.reduce((accumulator, event) => {
        const day = getEventDay(event);

        if (!accumulator[day]) {
            accumulator[day] = [];
        }

        accumulator[day].push(event);
        return accumulator;
    }, {} as { [day: string]: ClinicalEvent[] });

    const sortedDays = Object.keys(groupedByDay)
        .map(Number)
        .sort((a, b) => a - b);

    /*
     * Replace this with API data once the real TumorGraph table is available.
     */
    const tumorGraphNodes =
        showDemoTumorGraph && selectedPatientId && selectedSpecimenId
            ? buildDemoTumorGraphNodes(selectedPatientId, selectedSpecimenId)
            : [];

    const tumorGraphRoots = buildTree(tumorGraphNodes);
    const maximumPassage = getMaximumPassage(tumorGraphNodes);
    const stableLine = isStableTumorGraphLine(tumorGraphNodes);

    const selectedTumorGraphNode = tumorGraphNodes.find(
        node => node.id === selectedTumorGraphNodeId
    );

    return (
        <div style={{ padding: 24 }}>
            <h3>Research Tools</h3>

            <p style={{ color: '#666', maxWidth: 1000 }}>
                Research-specific tools for longitudinal sample inventory,
                specimen provenance, and TumorGraph lineage analysis.
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 18,
                    marginBottom: 22,
                    borderBottom: '1px solid #ddd',
                    paddingBottom: 10,
                }}
            >
                <Button
                    bsStyle={activeView === 'inventory' ? 'primary' : 'default'}
                    onClick={() => setActiveView('inventory')}
                >
                    Longitudinal Inventory
                </Button>

                <Button
                    bsStyle={
                        activeView === 'tumorgraph' ? 'primary' : 'default'
                    }
                    onClick={() => setActiveView('tumorgraph')}
                >
                    TumorGraph Lineage
                </Button>

                <Button
                    bsStyle={activeView === 'assistant' ? 'primary' : 'default'}
                    onClick={() => setActiveView('assistant')}
                >
                    Research Assistant
                </Button>
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 18,
                    alignItems: 'flex-end',
                }}
            >
                <div>
                    <label>Patient</label>
                    <FormControl
                        componentClass="select"
                        value={selectedPatientId}
                        onChange={(event: any) =>
                            setSelectedPatientId(event.target.value)
                        }
                        disabled={loadingPatients}
                        style={{ width: 240 }}
                    >
                        {patients.map(patient => (
                            <option
                                key={patient.patientId}
                                value={patient.patientId}
                            >
                                {patient.patientId}
                            </option>
                        ))}
                    </FormControl>
                </div>

                <div style={{ paddingBottom: 7, color: '#666' }}>
                    {patients.length} patients loaded from {studyId}
                </div>
            </div>

            {error && <div className="alert alert-warning">{error}</div>}

            {(loadingPatients || loadingEvents) && (
                <div>Loading patient data...</div>
            )}

            {!loadingPatients && !loadingEvents && activeView === 'inventory' && (
                <div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ fontWeight: 400 }}>
                            <input
                                type="checkbox"
                                checked={showDay0SpecimensOnly}
                                onChange={event =>
                                    setShowDay0SpecimensOnly(
                                        event.target.checked
                                    )
                                }
                                style={{ marginRight: 8 }}
                            />
                            Show Day 0 specimen collection only
                        </label>
                    </div>

                    <h4>Longitudinal Sample Inventory</h4>

                    {inventoryEvents.length === 0 && (
                        <div>
                            {showDay0SpecimensOnly
                                ? 'No Day 0 specimen collection events found for this patient.'
                                : 'No longitudinal events found for this patient.'}
                        </div>
                    )}

                    {inventoryEvents.length > 0 && (
                        <div>
                            <div
                                style={{
                                    marginBottom: 16,
                                    color: '#666',
                                }}
                            >
                                Showing {inventoryEvents.length} events for{' '}
                                <strong>{selectedPatientId}</strong>.
                            </div>

                            {sortedDays.map(day => (
                                <div
                                    key={day}
                                    style={{
                                        display: 'flex',
                                        gap: 20,
                                        marginBottom: 24,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 90,
                                            fontWeight: 800,
                                            color: '#1f77b4',
                                        }}
                                    >
                                        Day {day}
                                    </div>

                                    <div
                                        style={{
                                            borderLeft: '3px solid #1f77b4',
                                            paddingLeft: 18,
                                            flex: 1,
                                        }}
                                    >
                                        {groupedByDay[day].map(
                                            (event, index) => {
                                                const eventType = getEventType(
                                                    event
                                                );
                                                const stopDay = getStopDay(
                                                    event
                                                );
                                                const title = getEventTitle(
                                                    event
                                                );
                                                const details = getUsefulDetails(
                                                    event
                                                );

                                                const sampleId =
                                                    getAttributeValue(
                                                        event,
                                                        'SAMPLE_ID'
                                                    ) ||
                                                    (eventType === 'Specimen'
                                                        ? `Specimen ${index +
                                                              1}`
                                                        : title);

                                                const category =
                                                    eventType === 'Specimen'
                                                        ? inferSampleCategory(
                                                              sampleId
                                                          )
                                                        : getDetailedType(
                                                              event
                                                          ) || eventType;

                                                const assays = inferAssays(
                                                    sampleId,
                                                    eventType
                                                );

                                                return (
                                                    <div
                                                        key={`${day}-${eventType}-${index}`}
                                                        style={{
                                                            border:
                                                                '1px solid #ddd',
                                                            borderRadius: 6,
                                                            padding: 14,
                                                            marginBottom: 12,
                                                            background: '#fff',
                                                        }}
                                                    >
                                                        <div>
                                                            <span
                                                                style={getBadgeStyle(
                                                                    eventType
                                                                )}
                                                            >
                                                                {eventType}
                                                            </span>

                                                            <strong>
                                                                {title}
                                                            </strong>

                                                            <span
                                                                style={{
                                                                    marginLeft: 8,
                                                                    color:
                                                                        '#666',
                                                                }}
                                                            >
                                                                {category}
                                                            </span>

                                                            {stopDay !==
                                                                undefined &&
                                                                stopDay !==
                                                                    day && (
                                                                    <span
                                                                        style={{
                                                                            marginLeft: 8,
                                                                            color:
                                                                                '#666',
                                                                        }}
                                                                    >
                                                                        through
                                                                        day{' '}
                                                                        {
                                                                            stopDay
                                                                        }
                                                                    </span>
                                                                )}
                                                        </div>

                                                        {eventType ===
                                                            'Specimen' && (
                                                            <div
                                                                style={{
                                                                    marginTop: 10,
                                                                    display:
                                                                        'flex',
                                                                    gap: 8,
                                                                    flexWrap:
                                                                        'wrap',
                                                                }}
                                                            >
                                                                {assays.freshFrozen && (
                                                                    <span className="label label-info">
                                                                        Fresh
                                                                        frozen
                                                                    </span>
                                                                )}

                                                                {assays.rnaSeq && (
                                                                    <span className="label label-success">
                                                                        RNA-seq
                                                                    </span>
                                                                )}

                                                                {assays.wes && (
                                                                    <span className="label label-primary">
                                                                        WES
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {details.length > 0 && (
                                                            <div
                                                                style={{
                                                                    display:
                                                                        'grid',
                                                                    gridTemplateColumns:
                                                                        'repeat(auto-fit, minmax(180px, 1fr))',
                                                                    gap: 8,
                                                                    marginTop: 12,
                                                                }}
                                                            >
                                                                {details.map(
                                                                    (
                                                                        detail,
                                                                        detailIndex
                                                                    ) => (
                                                                        <div
                                                                            key={`${detail.key}-${detailIndex}`}
                                                                            style={{
                                                                                fontSize: 12,
                                                                                color:
                                                                                    '#444',
                                                                            }}
                                                                        >
                                                                            <strong>
                                                                                {
                                                                                    detail.key
                                                                                }

                                                                                :
                                                                            </strong>{' '}
                                                                            {
                                                                                detail.value
                                                                            }
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!loadingPatients && !loadingEvents && activeView === 'tumorgraph' && (
                <div>
                    <h4>TumorGraph Lineage</h4>

                    <p style={{ color: '#666', maxWidth: 950 }}>
                        Displays derivation relationships between the patient,
                        source specimen, TumorGraph model, passages, organoids,
                        and downstream assays.
                    </p>

                    <div className="alert alert-info" style={{ marginTop: 14 }}>
                        The RCC study currently contains real patient and
                        specimen events but does not yet include a TumorGraph
                        parent-child table. Demo lineage is clearly marked and
                        is used only to validate the interface and data model.
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: 20,
                            alignItems: 'flex-end',
                            marginBottom: 20,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div>
                            <label>Source specimen</label>
                            <FormControl
                                componentClass="select"
                                value={selectedSpecimenId}
                                onChange={(event: any) => {
                                    setSelectedSpecimenId(event.target.value);
                                    setSelectedTumorGraphNodeId('');
                                }}
                                disabled={specimenIds.length === 0}
                                style={{ width: 260 }}
                            >
                                {specimenIds.map(specimenId => (
                                    <option key={specimenId} value={specimenId}>
                                        {specimenId} —{' '}
                                        {inferSampleCategory(specimenId)}
                                    </option>
                                ))}
                            </FormControl>
                        </div>

                        <label
                            style={{
                                fontWeight: 400,
                                paddingBottom: 7,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={showDemoTumorGraph}
                                onChange={event => {
                                    setShowDemoTumorGraph(event.target.checked);
                                    setSelectedTumorGraphNodeId('');
                                }}
                                style={{ marginRight: 8 }}
                            />
                            Preview demo lineage
                        </label>
                    </div>

                    {specimenIds.length === 0 && (
                        <div>
                            No specimen records are available for this patient.
                        </div>
                    )}

                    {specimenIds.length > 0 && !showDemoTumorGraph && (
                        <div
                            style={{
                                padding: 20,
                                border: '1px dashed #aaa',
                                borderRadius: 6,
                                color: '#666',
                            }}
                        >
                            No real TumorGraph lineage records have been linked
                            yet. Enable the demo preview to test the tree
                            interface.
                        </div>
                    )}

                    {showDemoTumorGraph && tumorGraphNodes.length > 0 && (
                        <div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 12,
                                    marginBottom: 20,
                                }}
                            >
                                <div
                                    style={{
                                        border: '1px solid #ddd',
                                        borderRadius: 6,
                                        padding: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            color: '#666',
                                            fontSize: 12,
                                        }}
                                    >
                                        Total nodes
                                    </div>
                                    <strong style={{ fontSize: 20 }}>
                                        {tumorGraphNodes.length}
                                    </strong>
                                </div>

                                <div
                                    style={{
                                        border: '1px solid #ddd',
                                        borderRadius: 6,
                                        padding: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            color: '#666',
                                            fontSize: 12,
                                        }}
                                    >
                                        Furthest passage
                                    </div>
                                    <strong style={{ fontSize: 20 }}>
                                        P{maximumPassage}
                                    </strong>
                                </div>

                                <div
                                    style={{
                                        border: '1px solid #ddd',
                                        borderRadius: 6,
                                        padding: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            color: '#666',
                                            fontSize: 12,
                                        }}
                                    >
                                        Stable line
                                    </div>
                                    <strong
                                        style={{
                                            fontSize: 20,
                                            color: stableLine
                                                ? '#3c763d'
                                                : '#8a6d3b',
                                        }}
                                    >
                                        {stableLine ? 'Yes' : 'No'}
                                    </strong>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        'minmax(500px, 2fr) minmax(240px, 1fr)',
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
                                    {tumorGraphRoots.map(root => (
                                        <TumorGraphTreeNode
                                            key={root.id}
                                            node={root}
                                            selectedNodeId={
                                                selectedTumorGraphNodeId
                                            }
                                            onSelectNode={node =>
                                                setSelectedTumorGraphNodeId(
                                                    node.id
                                                )
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
                                    }}
                                >
                                    <h4
                                        style={{
                                            marginTop: 0,
                                            fontSize: 16,
                                        }}
                                    >
                                        Node Details
                                    </h4>

                                    <NodeDetails
                                        node={
                                            selectedTumorGraphNode as
                                                | TreeNode
                                                | undefined
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {!loadingPatients && !loadingEvents && activeView === 'assistant' && (
                <div>
                    <h4>Research Assistant</h4>

                    <p style={{ color: '#666', maxWidth: 900 }}>
                        Natural-language tools for querying the current study,
                        summarizing patient and specimen data, and navigating
                        Research Tools will be integrated here.
                    </p>

                    <div
                        style={{
                            border: '1px dashed #aaa',
                            borderRadius: 6,
                            padding: 24,
                            background: '#fafafa',
                            color: '#666',
                            maxWidth: 900,
                        }}
                    >
                        <strong>Research Assistant scaffold</strong>

                        <div style={{ marginTop: 8 }}>
                            This section is reserved for future LLM integration
                            with validated cBioPortal, longitudinal inventory,
                            and TumorGraph APIs.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
