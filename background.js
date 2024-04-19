async function fwd_fetch(message, sender, sendResponse) {
  let response = await fetch(message.url);
  let content = await response.text();
  return content;
}

// Listen for messages from content scripts
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
  case "fwd_fetch":
    return fwd_fetch(message, sender, sendResponse);
  }
});
