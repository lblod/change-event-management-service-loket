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
`;

const RECOGNITION_NOT_GRANTED = 'http://lblod.data.gift/concepts/343a00884d012cee6915bc7559cd69ef';
const RECOGNITION_GRANTED_TYPE = 'http://lblod.data.gift/concepts/3dd7550843eaf18e1fa1ca6c6c3f2610';
const PUBLIC_GRAPH = 'http://mu.semte.ch/graphs/public';

class WorshipServiceRepository {

  /**
   * Get all mandatarissen for a worship service
   * Excludes mandatarissen with prov:wasAssociatedWith predicate
   */
  static async getMandatarissenForWorshipService(worshipServiceUri) {
    const queryStr = `
      ${SPARQL_PREFIXES}
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT DISTINCT ?mandataris ?endDate WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ${sparqlEscapeUri(worshipServiceUri)} a ere:BestuurVanDeEredienst .
          ?bestuursorgaan besluit:bestuurt ${sparqlEscapeUri(worshipServiceUri)} .
          ?orgaanInTime generiek:isTijdspecialisatieVan ?bestuursorgaan .
          ?orgaanInTime org:hasPost ?mandaat .
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
   */
  static async setEndDatesOnMandatarissen(mandatarisUris, endDate) {
    if (!mandatarisUris || mandatarisUris.length === 0) {
      return;
    }

    const valuesClause = mandatarisUris.map(uri => sparqlEscapeUri(uri)).join(' ');

    const updateStr = `
      ${SPARQL_PREFIXES}

      DELETE {
        GRAPH ?orgGraph {
          ?mandataris mandaat:einde ?oldEndDate .
        }
      }
      INSERT {
        GRAPH ?orgGraph {
          ?mandataris mandaat:einde ${sparqlEscapeDateTime(endDate)} .
        }
      }
      WHERE {
        GRAPH ?orgGraph {
          VALUES ?mandataris { ${valuesClause} }
          ?mandataris mandaat:isBestuurlijkeAliasVan ?person .
          OPTIONAL {
            ?mandataris mandaat:einde ?oldEndDate .
          }
        }
      }
    `;

    await update(updateStr);
    console.log(`Set end date ${endDate} on ${mandatarisUris.length} mandataris(sen)`);
  }

  /**
   * Get the worship service URI from a change event
   */
  static async getWorshipServiceFromChangeEvent(changeEventUri) {
    const queryStr = `
      ${SPARQL_PREFIXES}

      SELECT ?worshipService WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ${sparqlEscapeUri(changeEventUri)} org:resultingOrganization ?worshipService .
        }
      }
    `;

    const result = await query(queryStr);
    if (result.results.bindings.length === 0) {
      return null;
    }

    return result.results.bindings[0].worshipService.value;
  }

  /**
   * Check if a change event is a worship service erkenning change event
   * (checks only the type, not whether it's the newest)
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

  /**
   * Check if a change event is the newest change event for its organization
   * Gets the newest change event URI for the organization and compares it to the given URI
   */
  static async isNewestChangeEvent(changeEventUri) {
    const queryStr = `
      ${SPARQL_PREFIXES}

      SELECT ?newestChangeEvent WHERE {
        GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
          ${sparqlEscapeUri(changeEventUri)} org:resultingOrganization ?worshipService .
          ?newestChangeEvent org:resultingOrganization ?worshipService .
          ?newestChangeEvent dc_terms:date ?date .
        }
      }
      ORDER BY DESC(?date)
      LIMIT 1
    `;

    const result = await query(queryStr);
    if (result.results.bindings.length === 0) {
      return false;
    }

    const newestChangeEventUri = result.results.bindings[0].newestChangeEvent.value;
    return newestChangeEventUri === changeEventUri;
  }

}

export default WorshipServiceRepository;
