// `version` changes on every build, so browsers fetch fresh CSS and JS after a deploy.
export default { year: new Date().getFullYear(), version: Date.now().toString(36) };
