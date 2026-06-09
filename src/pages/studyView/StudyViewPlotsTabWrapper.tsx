import * as React from 'react';
import { Button } from 'react-bootstrap';
import _ from 'lodash';
import { StudyViewPageStore } from 'pages/studyView/StudyViewPageStore';
import StudyViewURLWrapper from 'pages/studyView/StudyViewURLWrapper';
import { observer } from 'mobx-react';
import PlotsTab from 'shared/components/plots/PlotsTab';

function makePlotQuery(baseQuery: any) {
    const query = _.cloneDeep(baseQuery);

    query.plots_horz_selection = query.plots_horz_selection || {};
    query.plots_vert_selection = query.plots_vert_selection || {};
    query.plots_coloring_selection = query.plots_coloring_selection || {};

    return query;
}

const StudyViewPlotInstance = observer(function({
    store,
    urlWrapper,
}: {
    store: StudyViewPageStore;
    urlWrapper: StudyViewURLWrapper;
}) {
    const [localQuery, setLocalQuery] = React.useState<any>(() =>
        makePlotQuery(urlWrapper.query)
    );

    const localUrlWrapper = React.useMemo(() => {
        return {
            get query() {
                return localQuery;
            },
            updateURL: (updater: any) => {
                setLocalQuery((current: any) => {
                    const next = makePlotQuery(current);
                    const updated = updater(next) || next;
                    return makePlotQuery(updated);
                });
            },
        };
    }, [localQuery]);

    return (
        <PlotsTab
            filteredSamplesByDetailedCancerType={
                store.filteredSamplesByDetailedCancerType
            }
            mutations={store.mutations}
            studies={store.queriedPhysicalStudies}
            molecularProfileIdSuffixToMolecularProfiles={
                store.molecularProfileIdSuffixToMolecularProfiles
            }
            entrezGeneIdToGene={store.entrezGeneIdToGeneAll}
            sampleKeyToSample={store.sampleSetByKey}
            genes={store.allGenes}
            clinicalAttributes={store.clinicalAttributes}
            genesets={store.genesets}
            genericAssayEntitiesGroupByMolecularProfileId={
                store.genericAssayEntitiesGroupedByProfileId
            }
            customAttributes={store.customAttributes}
            studyIds={store.queriedPhysicalStudyIds}
            molecularProfilesWithData={store.molecularProfilesInStudies}
            molecularProfilesInStudies={store.molecularProfilesInStudies}
            annotatedCnaCache={store.annotatedCnaCache}
            annotatedMutationCache={store.annotatedMutationCache}
            structuralVariantCache={store.structuralVariantCache}
            studyToMutationMolecularProfile={
                store.studyToMutationMolecularProfile
            }
            studyToMolecularProfileDiscreteCna={
                store.studyToMolecularProfileDiscreteCna
            }
            clinicalDataCache={store.clinicalDataCache}
            patientKeyToFilteredSamples={store.patientKeyToFilteredSamples}
            numericGeneMolecularDataCache={store.numericGeneMolecularDataCache}
            coverageInformation={store.coverageInformation}
            filteredSamples={store.selectedSamples}
            genesetMolecularDataCache={store.genesetMolecularDataCache}
            genericAssayMolecularDataCache={
                store.genericAssayMolecularDataCache
            }
            studyToStructuralVariantMolecularProfile={
                store.studyToStructuralVariantMolecularProfile
            }
            driverAnnotationSettings={store.driverAnnotationSettings}
            studyIdToStudy={store.studyIdToStudy.result}
            structuralVariants={store.structuralVariants.result}
            hugoGeneSymbols={store.allHugoGeneSymbols.result}
            selectedGenericAssayEntitiesGroupByMolecularProfileId={
                store.selectedGenericAssayEntitiesGroupByMolecularProfileId
            }
            molecularProfileIdToMolecularProfile={
                store.molecularProfileIdToMolecularProfile
            }
            urlWrapper={localUrlWrapper as any}
            hasNoQueriedGenes={true}
            genePanelDataForAllProfiles={
                store.genePanelDataForAllProfiles.result
            }
            patients={store.patients}
        />
    );
});

export const PlotsTabWrapper: React.FunctionComponent<{
    store: StudyViewPageStore;
    urlWrapper: StudyViewURLWrapper;
}> = observer(function({ store, urlWrapper }) {
    const [plotIds, setPlotIds] = React.useState<number[]>([1]);

    const addPlot = () => {
        setPlotIds(current => [...current, Date.now()]);
    };

    const removePlot = (plotId: number) => {
        setPlotIds(current => current.filter(id => id !== plotId));
    };

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button bsStyle="primary" onClick={addPlot}>
                    + Add Plot
                </Button>
            </div>

            {plotIds.map((plotId, index) => (
                <div
                    key={plotId}
                    style={{
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        padding: 16,
                        marginBottom: 24,
                        background: '#fff',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <h4 style={{ margin: 0 }}>Plot {index + 1}</h4>

                        {plotIds.length > 1 && (
                            <Button
                                bsStyle="danger"
                                bsSize="small"
                                onClick={() => removePlot(plotId)}
                            >
                                Remove
                            </Button>
                        )}
                    </div>

                    <StudyViewPlotInstance
                        store={store}
                        urlWrapper={urlWrapper}
                    />
                </div>
            ))}
        </div>
    );
});
