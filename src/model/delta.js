const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const ORG_CHANGE_EVENT = 'http://www.w3.org/ns/org#ChangeEvent';
const PUBLIC_GRAPH = 'http://mu.semte.ch/graphs/public';

class Delta {

    constructor(delta) {
        this.delta = delta;
    }

    get inserts() {
        return this.delta.flatMap(changeSet => changeSet.inserts);
    }

    get deletes() {
        return this.delta.flatMap(changeSet => changeSet.deletes);
    }

    /**
     * Get all new ChangeEvent URIs inserted in the public graph
     */
    getNewChangeEvents() {
        const uris = this.inserts
            .filter(t =>
                t.predicate.value === RDF_TYPE &&
                t.object.value === ORG_CHANGE_EVENT &&
                t.graph.value === PUBLIC_GRAPH
            )
            .map(t => t.subject.value);
        return [...new Set(uris)];
    }
}

export default Delta;