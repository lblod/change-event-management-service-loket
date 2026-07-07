import WorshipServiceRepository from '../repository/worship-service-repository.js';

class DeltaService {

    /**
     * Main entry point to process change-events
     * Routes to different handlers based on the type of change event
     */
    static async processChangeEvents(changeEvents) {
        if (!changeEvents || changeEvents.length === 0) {
            console.log('No change events to process');
            return;
        }

        console.log(`Processing ${changeEvents.length} change events`);

        for (const changeEventUri of changeEvents) {
            try {
                console.log(`\nProcessing change event: ${changeEventUri}`);

                if (await WorshipServiceRepository.isWorshipServiceErkenningChangeEvent(changeEventUri)) {
                    await this.handleWorshipServiceErkenningChangeEvent(changeEventUri);
                }
                else {
                    console.log(`Nothing to do for this type of change-event`);
                }

            } catch (error) {
                console.error(`Error processing change event ${changeEventUri}:`, error);
                console.error(error.stack);
            }
        }

        console.log('\nFinished processing change events');
    }

    /**
     * Handle worship service erkenning change events
     * When a worship service changes from "in oprichting" to "active" or "inactive",
     * set enddate on mandatarissen
     *
     * @param {string} changeEventUri - The URI of the change event
     */
    static async handleWorshipServiceErkenningChangeEvent(changeEventUri) {
        console.log(`  ✓ Worship service erkenning change event detected`);
        const changeEvent = await WorshipServiceRepository.getWorshipServiceFromChangeEvent(changeEventUri);
        if (!changeEvent) {
            console.log(`  ✗ Could not find worship service for change event`);
            return;
        }
        const worshipServiceUri = changeEvent.uri;
        console.log(`  ✓ Found worship service: ${worshipServiceUri}`);

        const eventDate = changeEvent.date ? new Date(changeEvent.date) : new Date();
        const mandatarissen = await WorshipServiceRepository.getMandatarissenForWorshipService(worshipServiceUri, eventDate);
        if (mandatarissen.length === 0) {
            console.log(`  → No mandatarissen found for worship service (nothing to update)`);
            return;
        }
        console.log(`  ✓ Found ${mandatarissen.length} mandataris(sen)`);

        const openMandatarissen = mandatarissen.filter(m => !m.endDate);
        if (openMandatarissen.length === 0) {
            console.log(`  → All mandatarissen already have an end date (nothing to update)`);
            return;
        }

        const mandatarisUris = openMandatarissen.map(m => m.uri);
        await WorshipServiceRepository.setEndDatesOnMandatarissen(mandatarisUris, eventDate);
        console.log(`  ✓ Successfully set end date on ${mandatarisUris.length} mandataris(sen)`);
    }
}

export default DeltaService;