// -------------------------------------------------------------------
// Addon & content script communication

async function ext_fetch_text(url) {
  let text = await browser.runtime.sendMessage({
    action: "fwd_fetch",
    url
  });

  return text;
}

// This function delegates the Bugzilla API request to the background script of
// the addon to add the API Key registered by the user to the query.
async function bzapi_fetch(url) {
  return browser.runtime.sendMessage({
    action: "bzapi_fetch",
    url
  });
}

// -------------------------------------------------------------------
// Extract information from the page.
function get_current_bug_id() {
  return +document.getElementById("bug_id").value;
}

function extract_product() {
  return document.getElementById("product").value;
}

function extract_component() {
  return document.getElementById("component").value;
}

function isSpiderMonkeyIsland() {
  switch (extract_product()) {
  case "Core":
    break;
  default:
    return false;
  }

  switch (extract_component()) {
  case "JavaScript Engine":
  case "JavaScript Engine: JIT":
  case "JavaScript: GC":
  case "JavaScript: Internationalization API":
  case "JavaScript: Standard Library":
  case "JavaScript: WebAssembly":
  case "js-ctypes":
    break;
  default:
    return false;
  }
  return true;
}

// -------------------------------------------------------------------
// Collect blocked bugs and display them under the Meta section.

async function get_blocked_bugs_from_ids(bugs_ids) {
  let url = `https://bugzilla.mozilla.org/rest/bug?id=${bugs_ids.join()}`;
  let txt = await bzapi_fetch(url);
  return JSON.parse(txt);
}

async function fetch_all_blocked_bugs(bugs_ids) {
  let collected_desc = [];
  let collected_ids = [];
  while (bugs_ids.length) {
    // Collect the bugs metadata.
    let json = await get_blocked_bugs_from_ids(bugs_ids);

    collected_ids.push(...json.bugs.map(bug => bug.id));
    collected_desc.push(...json.bugs);

    // Collect the next bugs to visit.
    bugs_ids = json.bugs.flatMap(bug => bug.blocks);

    // Remove duplicates
    bugs_ids = bugs_ids.reduce(
      (l, id) => { if (!l.includes(id)) l.push(id); return l; },
      []);

    // Filter out bug ids which have already been visited.
    bugs_ids = bugs_ids.filter(id => !collected_ids.includes(id));
  }

  return collected_desc;
}

function sort_bugs(bugs) {
  let indexes = {};
  for (let bug of bugs) {
    indexes[bug.id] = 0;
  }

  let changed;
  do {
    changed = false;
    for (let bug of bugs) {
      let index = indexes[bug.id];
      for (let id of bug.blocks) {
        if (indexes[id] <= index) {
          changed = true;
          indexes[id] = index + 1;
        }
      }
    }
  } while (changed);

  function cmp(a, b) {
    let diff = indexes[a.id] - indexes[b.id];
    if (diff != 0) {
      return diff;
    }
    return a.id - b.id;
  }

  bugs.sort(cmp);
  return bugs;
}

function bug_desc_to_link(bug_desc) {
  let name = bug_desc.alias || `Bug ${bug_desc.id}`;
  return `
    <a class="bz_bug_link bz_status_${bug_desc.status}"
       title="${encodeURI(bug_desc.summary)}"
       href="/show_bug.cgi?id=${bug_desc.id}">${name}</a>
  `;
}

function meta_references(bugs) {
  return `
    <div id="field-meta" class="field bug-list">
      <div class="name"><a id="meta-help-link" class="help" href="https://bugzilla.mozilla.org/">Meta:</a></div>
      <div class="value"><span id="field-value-meta">
        <div class="bug-list>
	       ${bugs.map(bug_desc_to_link).join()}
        </div>
      </span></div>
    </div>
  `;
}

// -------------------------------------------------------------------
// Insert links / iframe to searchfox each time a source is mentioned.

// List of top-level directory names which might hint at the root of
// mozilla-central repository. Each time a path is found, we attempt to convert
// it to a searchfox link if we manage to find one of the following in the path.
let top_level_cpp_directories = [
  "accessible", "browser", "build", "caps", "chrome", "config", "devtools",
  "docshell", "dom", "editor", "extensions", "gfx", "hal", "image", "intl",
  "ipc", "js", "layout", "media", "memory", "mfbt", "mobile", "modules",
  "mozglue", "netwerk", "nsprpub", "other-licenses", "parser", "python",
  "security", "services", "startupcache", "storage", "testing", "third_party",
  "toolkit", "tools", "uriloader", "view", "widget", "xpcom", "xpfe"
];
let top_level_cpp_directories_rx =
  new RegExp("(?<=^|[/ ])(" + top_level_cpp_directories.join("|") + ")/");

let gdb_stack = /(?<= at )(?<path>([^: \n\t]|[\\][ ])+):(?<line>[0-9]+)/gu;
// frequently used by compilers and ASan-like reports
let path_row_col = /(?<=[ (]|[[])(?<path>([^: \n\t]|[\\][ ])+):(?<line>[0-9]+):(?<col>[0-9]+)/gu;
// Some crash reports only mention the file name :face_palm:
let crash_stack = /(?<= )\[(?<file>([^: \n\t/]|[\\][ ])+):(?<hgrev>[0-9a-f]+) : (?<line>[0-9]+)( [+] (?<binaryOffset>[x0-9a-f]*))?\]/gu;


const sf = "https://searchfox.org/mozilla-central"; // {search,source,hgrev,rev}
function searchfox_link(info, path) {
  let link = sf;
  if (info.hgrev) {
    link = `${link}/hgrev/${info.hgrev}`;
  } else if (info.gitrev) {
    link = `${link}/rev/${info.gitrev}`;
  } else {
    link = `${link}/source`;
  }

  link = `${link}/${path}`;

  if (info.line) {
    link = `${link}#${info.line}`;
  }

  return link;
}

let file_to_paths_cache = {};
async function file_to_paths(file, sf_search_url) {
  if (file in file_to_paths) {
    return file_to_paths[file];
  }

  // Query searchfox to find all path which might hold a file with the exact same name.
  console.log("loading:", sf_search_url);
  let text = await ext_fetch_text(sf_search_url);
  let parser = new DOMParser();
  let sfdoc = parser.parseFromString(text, "text/html");
  let content = sfdoc.getElementById("content");
  // The page is not filled yet, as this is handled in JavaScript, but the
  // result of the search is embedded in a script tag.
  let script = content.getElementsByTagName("script")[0].textContent;
  // Extract the "result" variable and parse it as JSON.
  let result = script.match(/(?<=results = )([^;]+)/)[0];
  result = JSON.parse(result);

  let paths = [];
  for (let f of result.normal.Files) {
    let path = f.path;
    if (path.split("/").slice(-1)[0] == file) {
      paths.push(path);
    }
  }

  file_to_paths_cache[file] = paths;
  return paths;
}

// This function is used to process all kind of file references, except that
// they do not all have the same information.
function add_searchfox_link(matched, info) {
  if (info.path) {
    let index = info.path.search(top_level_cpp_directories_rx);
    if (index === -1) {
      return matched; // path is not found, return the original text.
    }
    let a = document.createElement('a');
    a.appendChild(document.createTextNode(matched));
    a.setAttribute("href", searchfox_link(info, info.path.slice(index)));
    return a;
  }
  if (info.file) {
    // Who ever got the idea of annotating anything with only a file info never
    // had a project with multiple directory.
    //
    // This code would only query searchfox for a path when the link is clicked
    // by the user. We do not proactively query searchfox to reduce trafic and
    // avoid leaking extra information when not needed.
    document.createTextNode(matched);
    let a = document.createElement('a');
    a.appendChild(document.createTextNode(matched));
    a.setAttribute("href", '#');
    a.onclick = async function onclick(event) {
      event.preventDefault();
      // Resolve file name using searchfox.
      let search = `${sf}/search?q=&path=${info.file}&case=true&regexp=false`;
      let paths = await file_to_paths(info.file, search);

      // If multiple paths are found, leave this task for the user to decide
      // which one to visit next.
      if (paths.length > 1) {
        window.open(search, "_blank");
        return;
      } else if (paths.length == 0) {
        // TODO: Remove the link?
        return;
      }

      let target = searchfox_link(info, paths[0]);
      window.open(target, "_blank");
    };
    return a;
  }
}

function *splitAndAddLinks(text, regexps) {
  let matches = [];
  for (let regexp of regexps) {
    matches.push(...text.matchAll(regexp));
  }

  // Sort by first ocurrence, and if they 2 matches have the same index, take
  // the one with the largest context first.
  matches.sort((a, b) =>
    a.index > b.index || (a.index == b.index && a[0].length > b[0].length)
  );

  let idx = 0;
  for (let info of matches) {
    if (info.index < idx) {
      // Can happen if we have overlapping matches.
      continue;
    }

    // Copy the plain text.
    if (info.index > idx) {
      yield text.slice(idx, info.index);
      idx = info.index;
    }

    idx += info[0].length;
    yield add_searchfox_link(info[0], info.groups);
  }

  if (idx < text.length) {
    yield text.slice(idx);
  }
}

function* commentText() {
  let textNode;
  for (let comment of document.getElementsByClassName("comment-text")) {
    let iterator = document.createNodeIterator(comment, NodeFilter.SHOW_TEXT);
    while ((textNode = iterator.nextNode())) {
      if (textNode.parentElement.tagname == "a") {
        continue;
      }
      yield textNode;
    }
  }
}

async function add_searchfox_in_comments() {
  // NOTE: Collect all the textNode before replacing them, as otherwise it might
  // iterate over the newly inserted text elements.
  for (let textNode of [...commentText()]) {
    let nodes = [];
    textNode.replaceWith(...splitAndAddLinks(textNode.nodeValue, [
      gdb_stack,
      path_row_col,
      crash_stack
    ]));
  }
}

// -------------------------------------------------------------------
// Mutate the page.

function add_border_highlight(id) {
  let dom = document.getElementById(id);
  dom.style = "border: 2px dashed red;";
}

async function insert_meta_references() {
  let dom = document.getElementById("field-blocked");
  let id = get_current_bug_id();
  let bugs = await fetch_all_blocked_bugs([id]);
  bugs = sort_bugs(bugs);
  let html = meta_references(bugs);
  dom.insertAdjacentHTML('afterend', html);

  if (isSpiderMonkeyIsland()) {
    // Highlight the blocks section if this bug is part of the JavaScript
    // component but does not block "Bug SpiderMonkey".
    let is_rooted = bugs.reduce((res, b) => res || b.alias == "SpiderMonkey", false);
    if (!is_rooted) {
      add_border_highlight("field-blocked");
    }
  }
}

async function highlight_missing_triage() {
  // Check if the priority is set, otherwise highlight it.
  let priority = document.getElementById("priority").value;
  if (priority === "--") {
    // NOTE: There is a bug in bugzilla where the priority label is associated
    // with the importance section, and the priority field only corresponds to
    // the value of it as opposed to other fields.
    //
    // Thus this line would not put a border around the priority label, but only
    // its value.
    add_border_highlight("field-priority");
  }

  // Check if severity is properly set based on the bug type, otherwise
  // highlight it.
  let severity = document.getElementById("bug_severity")
      .getElementsByTagName("option")[0].attributes["value"]
      .value;
  let bug_type = document.getElementById("field-value-bug_type").textContent.trim();
  switch (`${bug_type}:${severity}`) {
  case "defect:S1":
  case "defect:S2":
  case "defect:S3":
  case "defect:S4":
  case "enhancement:N/A":
  case "task:N/A":
    break;
  default:
    add_border_highlight("field-bug_severity");
  }
}

async function onload_page_mutations() {
  // If the last tag is already present, no need to hook on onload
  let dom = document.getElementById("list_of_bugs");
  if (dom === undefined) {
    document.onload = once_loaded;
    return;
  }
  insert_meta_references();
  highlight_missing_triage();
  add_searchfox_in_comments();
}

onload_page_mutations();
