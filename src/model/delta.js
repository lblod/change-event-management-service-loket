import flatten from 'lodash.flatten';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const ORG_CHANGE_EVENT = 'http://www.w3.org/ns/org#ChangeEvent';
const PUBLIC_GRAPH = 'http://mu.semte.ch/graphs/public';

class Delta {

    constructor(delta) {
        this.delta = delta;
    }

    get inserts() {
        return flatten(this.delta.map(changeSet => changeSet.inserts));
    }

    get deletes() {
        return flatten(this.delta.map(changeSet => changeSet.deletes));
    }

    /**
     * Get all new ChangeEvent URIs inserted in the worship-service graph
     */
    getNewChangeEvents() {
        return this.inserts
            .filter(t =>
                t.predicate.value === RDF_TYPE &&
                t.object.value === ORG_CHANGE_EVENT &&
                t.graph.value === PUBLIC_GRAPH
            )
            .map(t => t.subject.value);
    }
}

export default Delta;