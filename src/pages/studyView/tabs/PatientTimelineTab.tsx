import * as React from 'react';
import { FormControl } from 'react-bootstrap';

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

    const match = attrs.find(
        attr =>
            attr.key === key ||
            attr.attributeId === key ||
            attr.key?.toLowerCase() === key.toLowerCase() ||
            attr.attributeId?.toLowerCase() === key.toLowerCase()
    );

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
    const attrs = event.attributes || [];

    return attrs
        .filter(attr => attr.value !== undefined && attr.value !== '')
        .map(attr => ({
            key: attr.key || attr.attributeId || 'Attribute',
            value: attr.value || '',
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

    const groupedByDay = inventoryEvents.reduce((acc, event) => {
        const day = getEventDay(event);

        if (!acc[day]) {
            acc[day] = [];
        }

        acc[day].push(event);
        return acc;
    }, {} as { [day: string]: ClinicalEvent[] });

    const sortedDays = Object.keys(groupedByDay)
        .map(Number)
        .sort((a, b) => a - b);

    return (
        <div style={{ padding: 24 }}>
            <h3>Research Tools</h3>

            <p style={{ color: '#666', maxWidth: 950 }}>
                Prototype research-specific longitudinal sample inventory. This
                extends beyond the native clinical timeline by focusing on what
                samples exist for each patient and what downstream resources may
                be connected to those samples.
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 16,
                    alignItems: 'flex-end',
                }}
            >
                <div>
                    <label>Patient</label>
                    <FormControl
                        componentClass="select"
                        value={selectedPatientId}
                        onChange={(e: any) =>
                            setSelectedPatientId(e.target.value)
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

            <div style={{ marginBottom: 24 }}>
                <label style={{ fontWeight: 400 }}>
                    <input
                        type="checkbox"
                        checked={showDay0SpecimensOnly}
                        onChange={e =>
                            setShowDay0SpecimensOnly(e.target.checked)
                        }
                        style={{ marginRight: 8 }}
                    />
                    Show Day 0 specimen collection only
                </label>
            </div>

            {error && <div className="alert alert-warning">{error}</div>}

            {(loadingPatients || loadingEvents) && (
                <div>Loading inventory...</div>
            )}

            {!loadingEvents && inventoryEvents.length === 0 && (
                <div>
                    {showDay0SpecimensOnly
                        ? 'No Day 0 specimen collection events found for this patient.'
                        : 'No longitudinal events found for this patient.'}
                </div>
            )}

            {!loadingEvents && inventoryEvents.length > 0 && (
                <div>
                    <h4>Longitudinal sample inventory</h4>

                    <div style={{ marginBottom: 16, color: '#666' }}>
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
                                {groupedByDay[day].map((event, index) => {
                                    const eventType = getEventType(event);
                                    const stopDay = getStopDay(event);
                                    const title = getEventTitle(event);
                                    const details = getUsefulDetails(event);

                                    const sampleId =
                                        getAttributeValue(event, 'SAMPLE_ID') ||
                                        (eventType === 'Specimen'
                                            ? `Specimen ${index + 1}`
                                            : title);

                                    const category =
                                        eventType === 'Specimen'
                                            ? inferSampleCategory(sampleId)
                                            : getDetailedType(event) ||
                                              eventType;

                                    const assays = inferAssays(
                                        sampleId,
                                        eventType
                                    );

                                    return (
                                        <div
                                            key={`${day}-${eventType}-${index}`}
                                            style={{
                                                border: '1px solid #ddd',
                                                borderRadius: 6,
                                                padding: 14,
                                                marginBottom: 12,
                                                background: '#fff',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
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

                                                    <strong>{title}</strong>

                                                    <span
                                                        style={{
                                                            marginLeft: 8,
                                                            color: '#666',
                                                        }}
                                                    >
                                                        {category}
                                                    </span>

                                                    {stopDay !== undefined &&
                                                        stopDay !== day && (
                                                            <span
                                                                style={{
                                                                    marginLeft: 8,
                                                                    color:
                                                                        '#666',
                                                                }}
                                                            >
                                                                through day{' '}
                                                                {stopDay}
                                                            </span>
                                                        )}
                                                </div>
                                            </div>

                                            {eventType === 'Specimen' && (
                                                <div
                                                    style={{
                                                        marginTop: 10,
                                                        display: 'flex',
                                                        gap: 8,
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    {assays.freshFrozen && (
                                                        <span className="label label-info">
                                                            Fresh frozen
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
                                                    {assays.dmso && (
                                                        <span className="label label-warning">
                                                            DMSO
                                                        </span>
                                                    )}
                                                    {assays.tumorgraph && (
                                                        <span className="label label-danger">
                                                            TumorGraph
                                                        </span>
                                                    )}
                                                    {assays.organoid && (
                                                        <span className="label label-default">
                                                            Organoid
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {details.length > 0 && (
                                                <div
                                                    style={{
                                                        display: 'grid',
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
                                                                    {detail.key}
                                                                    :
                                                                </strong>{' '}
                                                                {detail.value}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}

                                            {eventType === 'Specimen' && (
                                                <div
                                                    style={{
                                                        marginTop: 10,
                                                        color: '#777',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    Placeholder derivative
                                                    labels will later be
                                                    replaced with real inventory
                                                    / TumorGraph tables.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
