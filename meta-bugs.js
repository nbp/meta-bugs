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
  let response = await fetch(url);
  let blob = await response.blob();
  let txt = await blob.text();
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
// Mutate the page.

function add_border_highlight(id) {
  let dom = document.getElementById(id);
  dom.style = "border: 2px dashed red;";
}

async function insert_meta_references() {
  let dom = document.getElementById("field-blocked");
  if (dom === undefined) {
    document.onload = insert_meta_references;
  }
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
      .getElementsByTagName("bz-option")[0].attributes["value"]
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

insert_meta_references();
highlight_missing_triage();
