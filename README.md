# Change Event Management Service Loket

Microservice to update loket data based on incoming OP (Organisatieportaal) change-events.
Designed for the [semantic.works](https://semantic.works/) microservices stack.

This service provides an **extensible framework** for handling different types of organization change events. Currently, it manages mandataris end dates when worship services undergo status changes related to their official recognition (erkenning), but it can be easily extended to handle other change event types and business logic.

## How It Works

1. The service listens for delta notifications from [delta-notifier](https://github.com/mu-semtech/delta-notifier)
2. When a new `org:ChangeEvent` is created in the public graph, it gets extracted and processed
3. The service checks if it's the newest change event for that organization (older events are skipped)
4. The change event is routed through different handler functions based on its type
5. **Currently implemented**: Worship service erkenning change events (status changes from "in oprichting" to "erkend" or "niet erkend"):
   - Finds all mandatarissen associated with the worship service
   - Sets the current date as the end date (`mandaat:einde`) for those mandatarissen
   - Excludes mandatarissen with `prov:wasAssociatedWith` predicate (external data)

The architecture is designed to support multiple change event handlers, allowing you to add new business logic without modifying existing functionality.

## Use Cases

### Current Implementation: Worship Service Erkenning

When a worship service (eredienst) transitions from "in oprichting" to an officially recognized or rejected status, all existing mandatarissen need to be terminated. This service automates that process by setting end dates on those mandatarissen.

## Installation

### Docker Compose

Add the service to your `docker-compose.yml`:

```yaml
  change-event-management-service-loket:
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
    url: 'http://change-event-management-service-loket/delta',
    method: 'POST'
  },
  options: {
    resourceFormat: 'v0.0.1',
    gracePeriod: 1000,
    ignoreFromSelf: false
  }
}
```

## Configuration

### Environment Variables

| Variable             | Required | Default                       | Description                    |
|----------------------|----------|-------------------------------|--------------------------------|
| `DEBUG`              | No       | `false`                       | Enable debug logging           |

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
  - Verifies it's the newest change event for that organization
  - Checks if it's a worship service erkenning change event
  - Sets end dates on associated mandatarissen if applicable