import { app, errorHandler } from "mu";
import bodyParser from 'body-parser';
import Delta from "./src/model/delta.js";
import DeltaService from "./src/service/delta-service.js";

import {
  DEBUG
} from './env.js';

console.log('change-event-management-service-loket starting...');
if (DEBUG) {
  console.log('Debug mode enabled');
}

app.use(bodyParser.json());
app.use(errorHandler);

app.get("/", function (req, res) {
  res.send("Hello from change-event-management-service-loket!");
});

/**
 * Delta endpoint
 * Processes incoming deltas to detect change-events
 */
app.post('/delta', (req, res) => {
  if (DEBUG) {
    console.log('--- Delta received ---');
    console.log('Delta body:', JSON.stringify(req.body, null, 2));
  }

  const changeEvents = new Delta(req.body).getNewChangeEvents();
  if (changeEvents.length === 0) {
    console.log('Delta did not contain any new change-events, awaiting next batch');
    return res.status(204).send();
  }
  console.log(`Extracted ${changeEvents.length} new change events`);


  DeltaService.processChangeEvents(changeEvents)
    .catch(error => {
      console.error('Error processing change events:', error);
      console.error(error.stack);
    });

  console.log('Started processing change events, awaiting next batch');
  return res.status(204).send();
});

/**
 * Manual processing endpoint
 * Manually trigger processing of a change event by providing its URI
 * POST body: { "changeEventUri": "http://example.org/change-event/123" }
 * can be used for testing a specific change-event in data
 */
app.post('/manual-process', async (req, res) => {
  try {
    const { changeEventUri } = req.body;

    if (!changeEventUri) {
      return res.status(400).json({
        error: 'Missing changeEventUri in request body',
        example: { changeEventUri: 'http://example.org/change-event/123' }
      });
    }

    console.log(`--- Manually processing change event: ${changeEventUri} ---`);

    await DeltaService.processChangeEvents([changeEventUri]);

    console.log(`--- Finished processing change event ---`);
    return res.status(200).json({
      message: 'Change event processed successfully',
      changeEventUri
    });

  } catch (error) {
    console.error('Error processing change event:', error);
    console.error(error.stack);
    return res.status(500).json({
      error: 'Failed to process change event',
      message: error.message
    });
  }
});


app.use(errorHandler);
