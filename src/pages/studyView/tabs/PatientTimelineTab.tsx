import * as React from 'react';

type Patient = {
    patientId: string;
    studyId?: string;
};

type ClinicalEvent = {
    patientId?: string;
    startNumberOfDaysSinceDiagnosis?: number;
    stopNumberOfDaysSinceDiagnosis?: number;
    startDate?: number;
    stopDate?: number;
    eventType?: string;
    eventTypeDetailed?: string;
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
        a =>
            a.key === key ||
            a.attributeId === key ||
            a.key?.toLowerCase() === key.toLowerCase() ||
            a.attributeId?.toLowerCase() === key.toLowerCase()
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

    if (!attrs.length) {
        return [];
    }

    return attrs
        .filter(attr => attr.value !== undefined && attr.value !== '')
        .map(attr => ({
            key: attr.key || attr.attributeId || 'Attribute',
            value: attr.value || '',
        }));
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

export default function PatientTimelineTab({ studyId }: { studyId: string }) {
    const [patients, setPatients] = React.useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = React.useState('');
    const [events, setEvents] = React.useState<ClinicalEvent[]>([]);
    const [loadingPatients, setLoadingPatients] = React.useState(false);
    const [loadingEvents, setLoadingEvents] = React.useState(false);
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
                    .map((p: any) => ({
                        patientId: p.patientId,
                        studyId: p.studyId,
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
        async function loadClinicalEvents() {
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
                setError(
                    `${err.message}. If this endpoint differs in this cBioPortal version, we will inspect the generated API client and swap in the correct endpoint.`
                );
                setEvents([]);
            } finally {
                setLoadingEvents(false);
            }
        }

        loadClinicalEvents();
    }, [studyId, selectedPatientId]);

    const groupedEvents = events.reduce((acc, event) => {
        const day = getEventDay(event);
        if (!acc[day]) {
            acc[day] = [];
        }
        acc[day].push(event);
        return acc;
    }, {} as { [day: string]: ClinicalEvent[] });

    const sortedDays = Object.keys(groupedEvents)
        .map(Number)
        .sort((a, b) => a - b);

    return (
        <div style={{ padding: 24 }}>
            <h3>Patient Timeline</h3>

            <p style={{ color: '#666', maxWidth: 950 }}>
                This tab visualizes imported cBioPortal clinical timeline events
                for the selected patient, including specimens, treatments,
                surgeries, and status changes.
            </p>

            <div
                style={{
                    marginTop: 16,
                    marginBottom: 24,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <label style={{ fontWeight: 700 }}>Patient:</label>

                <select
                    value={selectedPatientId}
                    onChange={e => setSelectedPatientId(e.target.value)}
                    disabled={loadingPatients}
                    style={{
                        padding: '6px 10px',
                        minWidth: 220,
                    }}
                >
                    {patients.map(patient => (
                        <option
                            key={patient.patientId}
                            value={patient.patientId}
                        >
                            {patient.patientId}
                        </option>
                    ))}
                </select>

                <span style={{ color: '#666' }}>
                    {patients.length} patients loaded from {studyId}
                </span>
            </div>

            {error && (
                <div
                    style={{
                        padding: 12,
                        background: '#fff3cd',
                        border: '1px solid #ffeeba',
                        borderRadius: 4,
                        marginBottom: 16,
                        color: '#856404',
                    }}
                >
                    {error}
                </div>
            )}

            {(loadingPatients || loadingEvents) && (
                <div>Loading timeline...</div>
            )}

            {!loadingEvents && !error && events.length === 0 && (
                <div>No timeline events found for this patient.</div>
            )}

            {!loadingEvents && events.length > 0 && (
                <div>
                    <div style={{ marginBottom: 16, color: '#666' }}>
                        Showing {events.length} timeline events for{' '}
                        <strong>{selectedPatientId}</strong>.
                    </div>

                    {sortedDays.map(day => (
                        <div key={day} style={{ marginBottom: 28 }}>
                            <div
                                style={{
                                    fontWeight: 800,
                                    color: '#1f77b4',
                                    marginBottom: 8,
                                    fontSize: 16,
                                }}
                            >
                                Day {day}
                            </div>

                            <div
                                style={{
                                    borderLeft: '3px solid #1f77b4',
                                    paddingLeft: 18,
                                }}
                            >
                                {groupedEvents[day].map((event, index) => {
                                    const type = getEventType(event);
                                    const stopDay = getStopDay(event);
                                    const details = getUsefulDetails(event);

                                    return (
                                        <div
                                            key={`${day}-${type}-${index}`}
                                            style={{
                                                padding: 14,
                                                marginBottom: 12,
                                                border: '1px solid #ddd',
                                                borderRadius: 6,
                                                background: '#fff',
                                                boxShadow:
                                                    '0 1px 2px rgba(0,0,0,0.04)',
                                            }}
                                        >
                                            <div style={{ marginBottom: 6 }}>
                                                <span
                                                    style={getBadgeStyle(type)}
                                                >
                                                    {type}
                                                </span>

                                                <strong>
                                                    {getEventTitle(event)}
                                                </strong>

                                                {stopDay !== undefined &&
                                                    stopDay !== day && (
                                                        <span
                                                            style={{
                                                                marginLeft: 8,
                                                                color: '#666',
                                                            }}
                                                        >
                                                            through day{' '}
                                                            {stopDay}
                                                        </span>
                                                    )}
                                            </div>

                                            {details.length > 0 && (
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns:
                                                            'repeat(auto-fit, minmax(180px, 1fr))',
                                                        gap: 8,
                                                        marginTop: 10,
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
