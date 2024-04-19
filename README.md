# Meta Bugs

![alt text](https://github.com/nbp/meta-bugs/blob/master/images/example-01.png?raw=true)

When visiting bugzilla, a bug has a list of dependencies and a list of blocked
bug. This addons add a new read-only section which displays the transitive list
of blocked bug.

The addon is used as a discovery mechanism for finding siblings of existing
bugs, or to know what part of the project the current bug is contributing to.

Additionally it will highlight areas which have to be updated while triaging the
bugs, by adding an extra red border around fields which have to be updated.

This addon is available at https://addons.mozilla.org/firefox/addon/meta-bugs/

## Testing locally

This is a Firefox addon, which might also work in other browsers.

Before testing your modification, make sure to disable the addon coming from
https://addons.mozilla.org/ by navigating to `about:addons`.

To test your modifications within Firefox, open `about:debugging`, and load the
`manifest.json` as a temporary addon.

## Packaging

To package this repository into an addon, you can use `nix build`, which will
create a symbolic link named result which will contain the zip file to be
uploaded.
