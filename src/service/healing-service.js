import WorshipServiceRepository from '../repository/worship-service-repository.js';
import DeltaService from './delta-service.js';

class HealingService {

    static isRunning = false;

    /**
     * Reprocess all erkenning change events, oldest first.
     */
    static async runHealing() {
        if (this.isRunning) {
            console.log('Healing already in progress, skipping this run');
            return null;
        }

        this.isRunning = true;
        try {
            console.log('--- Healing: reprocessing all erkenning change events ---');
            const changeEvents = await WorshipServiceRepository.getAllErkenningChangeEvents();
            console.log(`Healing: found ${changeEvents.length} erkenning change event(s)`);

            await DeltaService.processChangeEvents(changeEvents);

            console.log('--- Healing finished ---');
            return { processed: changeEvents.length };
        } finally {
            this.isRunning = false;
        }
    }
}

export default HealingService;
