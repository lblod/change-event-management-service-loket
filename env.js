import env from 'env-var';

const DEBUG = env.get('DEBUG').default('false').asBool();

export {
    DEBUG,
};
