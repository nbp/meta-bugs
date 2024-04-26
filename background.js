let reactions = {
  async fwd_fetch(message, sender, sendResponse) {
    let response = await fetch(message.url);
    let content = await response.text();
    return content;
  },

  async bzapi_fetch(message, sender, sendResponse) {
    let { ["bugzilla"]: settings } = await browser.storage.local.get("bugzilla");
    settings = settings || {};
    let url = message.url;
    let opt = { method: "GET", headers: {} };
    if ("apiKey" in settings) {
      opt.headers["X-BUGZILLA-API-KEY"] = settings.apiKey;
    }
    let response = await fetch(url, opt);
    let txt = await response.text();
    return txt;
  },

  async csapi_fetch(message, sender, sendResponse) {
    let { ["crash-stats"]: settings } = await browser.storage.local.get("crash-stats");
    settings = settings || {};
    let url = message.url;
    let opt = { method: "GET", headers: {} };
    if ("apiToken" in settings) {
      opt.headers["Auth-Token"] = settings.apiToken;
    }
    let response = await fetch(url, opt);
    let txt = await response.text();
    return txt;
  }
};

// Listen for messages from content scripts
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  return await reactions[message.action](message, sender, sendResponse);
});
