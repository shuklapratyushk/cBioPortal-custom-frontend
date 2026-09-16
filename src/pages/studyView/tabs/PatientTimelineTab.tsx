import * as React from 'react';
import { Button, FormControl } from 'react-bootstrap';
import TumorGraftLineage from './TumorGraftLineage';

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
            } catch (err) {
                setError(err.message || 'Could not load patient events.');
                setEvents([]);
            } finally {
                setLoadingEvents(false);
            }
        }

        loadEvents();
    }, [studyId, selectedPatientId]);

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

    return (
        <div style={{ padding: 24 }}>
            <h3>Research Tools</h3>

            <p style={{ color: '#666', maxWidth: 1000 }}>
                Research-specific tools for longitudinal sample inventory,
                specimen provenance, and TumorGraft provenance analysis.
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
                    TumorGraft Lineage
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

            {!loadingPatients &&
                !loadingEvents &&
                activeView === 'tumorgraph' && (
                    <TumorGraftLineage
                        studyId={studyId}
                        patientId={selectedPatientId}
                    />
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
                            and TumorGraft provenance APIs.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
