import env from 'env-var';

const DEBUG = env.get('DEBUG').default('false').asBool();
const MAX_BODY_SIZE = env.get('MAX_BODY_SIZE').default('50mb').asString();
const HEALING_ENABLED = env.get('HEALING_ENABLED').default('true').asBool();
// Default: every Saturday at 03:00
const HEALING_CRON_PATTERN = env.get('HEALING_CRON_PATTERN').default('0 0 3 * * 6').asString();

export {
    DEBUG,
    MAX_BODY_SIZE,
    HEALING_ENABLED,
    HEALING_CRON_PATTERN,
};
