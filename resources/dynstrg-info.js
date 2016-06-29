var dynstrgInfo;
const VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES || '{}');

if (VCAP_SERVICES && VCAP_SERVICES.dynstrg) {
  dynstrgInfo = VCAP_SERVICES.dynstrg[0];
} else {
  dynstrgInfo = {};
}

module.exports = dynstrgInfo;
