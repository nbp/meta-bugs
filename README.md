# Meta Bugs

![alt text](https://github.com/nbp/meta-bugs/blob/master/images/example-01.png?raw=true)

This addon improves [bugzilla](https://bugzilla.mozilla.org) user experience with
additional information to help with the triage and resolution efforts.

When installed and enabled, this addon will:
 - Building a transitive list of bugs blocked.
 - Highlight in red fields which have to be set when triaging.
   * Priorities should be set.
   * Severity should be set to N/A for non-defects, and to some value for defects.
   * Block list of bug should transitively block [Bug SpiderMonkey](https://bugzilla.mozilla.org/show_bug.cgi?id=spidermonkey).
 - Replace file names of source files by links to [searchfox](https://searchfox.mozilla.org) when possible.
 - Query [crash-stats](https://crash-stats.mozilla.org/) to display bugs with similar signatures.

This addon is available at https://addons.mozilla.org/firefox/addon/meta-bugs/

## Testing locally

This is a Firefox addon, which might also work in other browsers.

Before testing your modification, make sure to disable the addon coming from
https://addons.mozilla.org/ by navigating to `about:addons`.

To test your modifications within Firefox, open `about:debugging`, and load the
`manifest.json` as a temporary addon.

## Packaging

To package this repository into an addon, you can use `nix build`, which will
create a symbolic link named `result` which will contain the zip file to be
uploaded.
