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
  } while (!changed);

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
       title="${bug_desc.summary}"
       href="/show_bug.cgi?id=${bug_desc.id}">${name}</a>
  `;
}

function rooted_references(bugs) {
  return `
    <div id="field-rooted" class="field bug-list">
      <div class="name"><a id="rooted-help-link" class="help" href="https://bugzilla.mozilla.org/">Rooted:</a></div>
      <div class="value"><span id="field-value-rooted">
        <div class="bug-list>
	       ${bugs.map(bug_desc_to_link).join()}
        </div>
      </span></div>
    </div>
  `;
}

function get_current_bug_id() {
  return +document.getElementById("bug_id").value;
}

async function insert_rooted_references() {
  let dom = document.getElementById("field-blocked");
  if (dom === undefined) {
    document.onload = insert_rooted_references;
  }
  let id = get_current_bug_id();
  let bugs = await fetch_all_blocked_bugs([id]);
  bugs = sort_bugs(bugs);
  let html = rooted_references(bugs);
  dom.insertAdjacentHTML('afterend', html);
}

insert_rooted_references();
