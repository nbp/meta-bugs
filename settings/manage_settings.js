const Options = {
  async init() {
    console.log("Initting Settings page");

    console.debug("Populating form");
    let services = ["bugzilla"];
    await Promise.all(services.map(
      serviceType => this.initService(serviceType)
    ));

    console.debug("Adding change event listener");
    window.addEventListener("change", this);

    let initted = new CustomEvent("initted", { bubbles: true, });
    document.dispatchEvent(initted);
  },

  async initService(serviceType) {
    let { [serviceType]: settings } = await browser.storage.local.get(serviceType);
    settings = settings || {};

    let domSettings =
        document.querySelector(`.service-settings[data-type='${serviceType}']`);

    for (let key of Object.keys(settings)) {
      try {
        let field = domSettings.querySelector(`[data-setting='${key}']`);
        field.value = settings[key];
      } catch (err) {
        // Stale fields which are not listed in the DOM are removed.
        delete settings[key];
        await browser.storage.local.set({ [serviceType]: settings, });
      }
    }
  },

  // Given an event and a data-type of a service-settings DOM element, update
  // the corresponding storage with the newly updated value.
  async onUpdateService(event, serviceType) {
    let changedSetting = event.target.dataset.setting;
    let newValue;
    switch (event.target.type) {
    case "text":
    case "password":
      newValue = event.target.value;
      break;
    }

    let settings = await browser.storage.local.get(serviceType);
    if (newValue !== undefined) {
      settings[changedSetting] = newValue;
    } else {
      delete settings[changedSetting];
    }

    await browser.storage.local.set({ [serviceType]: settings, });
    console.log(`Saved update to ${serviceType} setting ${changedSetting}`);
  },

  handleEvent(event) {
    if (event.type === "change") {
      // Find any parent node which has the class service-settings.
      let serviceSettings = event.target.closest(".service-settings");
      if (!serviceSettings) {
        return;
      }
      // service-settings nodes also have a data-type attribtue which is
      // forwarded to onUpdateService.
      this.onUpdateService(event, serviceSettings.dataset.type);
    }
  },
};

addEventListener("DOMContentLoaded", () => {
  Options.init();
}, { once: true, });
