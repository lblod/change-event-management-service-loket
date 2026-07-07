import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri, sparqlEscapeDateTime } from 'mu';

const SPARQL_PREFIXES = `
  PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
  PREFIX ere: <http://data.lblod.info/vocabularies/erediensten/>
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
  PREFIX generiek: <https://data.vlaanderen.be/ns/generiek#>
  PREFIX org: <http://www.w3.org/ns/org#>
  PREFIX regorg: <http://www.w3.org/ns/regorg#>
  PREFIX dc_terms: <http://purl.org/dc/terms/>
  PREFIX contacthub: <http://data.lblod.info/vocabularies/contacthub/>
  PREFIX prov: <http://www.w3.org/ns/prov#>
`;

const RECOGNITION_NOT_GRANTED = 'http://lblod.data.gift/concepts/343a00884d012cee6915bc7559cd69ef';
const RECOGNITION_GRANTED_TYPE = 'http://lblod.data.gift/concepts/3dd7550843eaf18e1fa1ca6c6c3f2610';
const PUBLIC_GRAPH = 'http://mu.semte.ch/graphs/public';

class WorshipServiceRepository {

  /**
   * Get all mandatarissen for a worship service, limited to the
   * bestuursorganen-in-tijd whose period covers the given reference date.
   * The start bound is strict: a period starting exactly on the reference
   * date is the successor created by the change event itself, and its
   * mandatarissen must not be ended.
   * Excludes mandatarissen with prov:wasAssociatedWith predicate
   */
  static async getMandatarissenForWorshipService(worshipServiceUri, referenceDate) {
    const queryStr = `
      ${SPARQL_PREFIXES}
      SELECT DISTINCT ?mandataris ?endDate WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ${sparqlEscapeUri(worshipServiceUri)} a ere:BestuurVanDeEredienst .
          ?bestuursorgaan besluit:bestuurt ${sparqlEscapeUri(worshipServiceUri)} .
          ?orgaanInTime generiek:isTijdspecialisatieVan ?bestuursorgaan .
          ?orgaanInTime org:hasPost ?mandaat .

          OPTIONAL { ?orgaanInTime mandaat:bindingStart ?bindingStart . }
          OPTIONAL { ?orgaanInTime mandaat:bindingEinde ?bindingEinde . }
          FILTER(!BOUND(?bindingStart) || ?bindingStart < ${sparqlEscapeDateTime(referenceDate)})
          FILTER(!BOUND(?bindingEinde) || ?bindingEinde >= ${sparqlEscapeDateTime(referenceDate)})
        }

        GRAPH ?orgGraph {
          ?mandataris mandaat:isBestuurlijkeAliasVan ?person ;
                      org:holds ?mandaat .

          OPTIONAL {
            ?mandataris mandaat:einde ?endDate .
          }

          FILTER NOT EXISTS {
            ?mandataris prov:wasAssociatedWith ?p .
          }
        }
      }
    `;

    const result = await query(queryStr);
    return result.results.bindings.map(binding => ({
      uri: binding.mandataris.value,
      endDate: binding.endDate ? binding.endDate.value : null
    }));
  }

  /**
   * Set end dates on mandatarissen
   * Only inserts an end date on mandatarissen that don't have one yet.
   */
  static async setEndDatesOnMandatarissen(mandatarisUris, endDate) {
    if (!mandatarisUris || mandatarisUris.length === 0) {
      return;
    }

    const valuesClause = mandatarisUris.map(uri => sparqlEscapeUri(uri)).join(' ');

    const updateStr = `
      ${SPARQL_PREFIXES}

      INSERT {
        GRAPH ?orgGraph {
          ?mandataris mandaat:einde ${sparqlEscapeDateTime(endDate)} .
        }
      }
      WHERE {
        GRAPH ?orgGraph {
          VALUES ?mandataris { ${valuesClause} }
          ?mandataris mandaat:isBestuurlijkeAliasVan ?person .
          FILTER NOT EXISTS {
            ?mandataris mandaat:einde ?existingEndDate .
          }
        }
      }
    `;

    await update(updateStr);
    console.log(`Set end date ${endDate} on ${mandatarisUris.length} mandataris(sen)`);
  }

  /**
   * Get the worship service URI and the event date (dc_terms:date) from a change event
   */
  static async getWorshipServiceFromChangeEvent(changeEventUri) {
    const queryStr = `
      ${SPARQL_PREFIXES}

      SELECT ?worshipService ?date WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ${sparqlEscapeUri(changeEventUri)} org:resultingOrganization ?worshipService .
          OPTIONAL {
            ${sparqlEscapeUri(changeEventUri)} dc_terms:date ?date .
          }
        }
      }
    `;

    const result = await query(queryStr);
    if (result.results.bindings.length === 0) {
      return null;
    }

    const binding = result.results.bindings[0];
    return {
      uri: binding.worshipService.value,
      date: binding.date ? binding.date.value : null
    };
  }

  /**
   * Get all worship service erkenning change events, oldest first.
   * Used by the healing job to reprocess the full event history.
   */
  static async getAllErkenningChangeEvents() {
    const queryStr = `
      ${SPARQL_PREFIXES}
      SELECT DISTINCT ?changeEvent ?date WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ?changeEvent contacthub:typeWijziging ?typeWijziging ;
                       org:resultingOrganization ?worshipService .

          OPTIONAL { ?changeEvent dc_terms:date ?date . }

          FILTER(?typeWijziging IN (${sparqlEscapeUri(RECOGNITION_NOT_GRANTED)}, ${sparqlEscapeUri(RECOGNITION_GRANTED_TYPE)}))
        }
      }
      ORDER BY ASC(?date)
    `;

    const result = await query(queryStr);
    return result.results.bindings.map(binding => binding.changeEvent.value);
  }

  /**
   * Check if a change event is a worship service erkenning change event
   */
  static async isWorshipServiceErkenningChangeEvent(changeEventUri) {
    const queryStr = `
      ${SPARQL_PREFIXES}
      PREFIX contacthub: <http://data.lblod.info/vocabularies/contacthub/>

      SELECT ?worshipService ?typeWijziging WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ${sparqlEscapeUri(changeEventUri)} contacthub:typeWijziging ?typeWijziging ;
                                              org:resultingOrganization ?worshipService .

          FILTER(?typeWijziging IN (${sparqlEscapeUri(RECOGNITION_NOT_GRANTED)}, ${sparqlEscapeUri(RECOGNITION_GRANTED_TYPE)}))
        }
      }
    `;

    const result = await query(queryStr);
    return result.results.bindings.length > 0;
  }

}

export default WorshipServiceRepository;
