# Rooted Bugs

When visiting bugzilla, a bug would have a list of dependencies and a list of
blocks bug. This addon add a new read-only section which displays the transitive
list of blocks bug. Bugs which are blocked by the visited bug.

This way, once given a link one can know whether to feel concerned by a bug by
looking whether this is blocking some important work.

This should help discover bugs which are sibblings without having to follow
multiple links.
