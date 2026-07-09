# Change Event Management Service Loket

Microservice to update loket data based on incoming OP (Organisatieportaal) change-events.
Designed for the [semantic.works](https://semantic.works/) microservices stack. 

This service provides an **extensible framework** for handling different types of organization change events. Currently, it manages mandataris end dates when worship services undergo status changes related to their official recognition (erkenning), but it can be easily extended to handle other change event types and business logic.

## How It Works

1. The service listens for delta notifications from [delta-notifier](https://github.com/mu-semtech/delta-notifier)
2. When a new `org:ChangeEvent` is created in the public graph, it gets extracted and processed
3. The change event is routed through different handler functions based on its type
4. **Currently implemented**: Worship service erkenning change events (status changes from "in oprichting" to "erkend" or "niet erkend"):
   - Finds the mandatarissen of the bestuursorgaan-in-tijd that was closed by the transition, i.e. whose `mandaat:bindingEinde` equals the change event's date (`dcterms:date`).
   - Sets the change event's date as the end date (`mandaat:einde`) on mandatarissen that don't have one yet — existing end dates are never overwritten
   - Excludes mandatarissen with `prov:wasAssociatedWith` predicate (external data)


### Healing

A weekly cron job (Saturday 03:00 by default, see `HEALING_CRON_PATTERN`) reprocesses **all** erkenning change events, oldest first. A healing run can also be triggered manually via `POST /healing`.

The architecture is designed to support multiple change event handlers, allowing you to add new business logic without modifying existing functionality.

## Use Cases

### Current Implementation: Worship Service Erkenning

When a worship service (eredienst) transitions from "in oprichting" to an officially recognized or rejected status, the mandatarissen of the bestuursorgaan active at that moment need to be terminated. This service automates that process by setting end dates on those mandatarissen.

## Installation

### Docker Compose

Add the service to your `docker-compose.yml`:

```yaml
  change-event-management-loket:
    image: lblod/change-event-management-service-loket
    environment:
      DEBUG: "false"
    labels:
      - "logging=true"
    restart: always
```

### Delta Notifier Configuration

Add a rule to your `config/delta/rules.js` to trigger on new change events:

```javascript
{
  match: {
    predicate: {
      type: 'uri',
      value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    },
    object: {
      type: 'uri',
      value: 'http://www.w3.org/ns/org#ChangeEvent'
    },
    graph: {
      type: 'uri',
      value: 'http://mu.semte.ch/graphs/public'
    }
  },
  callback: {
    url: 'http://change-event-management-loket/delta',
    method: 'POST'
  },
  options: {
    resourceFormat: 'v0.0.1',
    gracePeriod: 1000,
    ignoreFromSelf: true
  }
}
```

## Configuration

### Environment Variables

| Variable               | Required | Default       | Description                                          |
|------------------------|----------|---------------|------------------------------------------------------|
| `DEBUG`                | No       | `false`       | Enable debug logging                                 |
| `MAX_BODY_SIZE`        | No       | `50mb`        | Maximum accepted request body size (delta payloads)  |
| `HEALING_ENABLED`      | No       | `true`        | Enable the weekly healing cron job                   |
| `HEALING_CRON_PATTERN` | No       | `0 0 3 * * 6` | Cron pattern for the healing job (Saturday 03:00)    |

## API

### GET /

Health check endpoint. Returns a welcome message.

**Response**:

- `200 OK` - Returns "Hello from change-event-management-service-loket!"

### POST /delta

Receives delta notifications for new `org:ChangeEvent` resources.

**Request Body**: Delta notification in mu-delta-notifier format (v0.0.1)

**Response**:

- `204 No Content` - Delta received and being processed

**Functionality**:

- Extracts new `org:ChangeEvent` URIs from the public graph
- Processes change events asynchronously
- For each change event:
  - Checks if it's a worship service erkenning change event
  - Sets the event date as end date on the open mandatarissen of the bestuursorgaan-in-tijd that was closed on that date by the transition; a no-op when that closing has not synced from OP yet (healing catches up)

### POST /manual-process

Manually trigger processing of a single change event, e.g. for testing or healing a missed event.

**Request Body**:

```json
{ "changeEventUri": "http://example.org/change-event/123" }
```

**Response**:

- `200 OK` - Change event processed
- `400 Bad Request` - Missing `changeEventUri`
- `500 Internal Server Error` - Processing failed

### POST /healing

Manually trigger a healing run: reprocesses all erkenning change events, oldest first. Runs asynchronously; the same logic runs on the healing cron schedule.

**Response**:

- `202 Accepted` - Healing started
- `409 Conflict` - A healing run is already in progress