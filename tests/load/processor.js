/**
 * Artillery processor - fetches contact IDs before test and injects into context
 */
const http = require("http");

let contactIds = [];

function fetchContacts() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path: "/contacts?accountId=acc_001&limit=100",
        method: "GET",
      },
      (res) => {
        let data = "";
        res.on("data", (ch) => (data += ch));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            contactIds = (json.contacts || []).map((c) => c.id);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

module.exports = {
  beforeScenario: async (context, events, done) => {
    if (contactIds.length === 0) {
      try {
        await fetchContacts();
      } catch (e) {
        console.error("Failed to fetch contacts:", e.message);
      }
    }
    context.vars.contactIds = contactIds.slice(0, 50);
    return done();
  },
};
