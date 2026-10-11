# UI declutter: before and after

Screenshots of each page at 1440 px and 390 px, taken against the local API with the same 5-seed default run
(`?run=…&view=grid`; the city map's OpenStreetMap tiles could not load in the capture environment, so every map
shot is the grid). `before-*` is `main` at a63167d, `after-*` is this branch.

Visible words = words in `document.body.innerText` that contain a letter or digit, after removing icon-font
ligatures and the unopened options of `<select>` elements. Text behind (i) popovers, closed toggles and
"Show all …" is not counted because it is not on screen until asked for.

| Page | Width | Before | After | Change |
|---|---|---|---|---|
| simulator | 1440 px | 937 | 518 | -45% |
| rider | 1440 px | 169 | 113 | -33% |
| audit | 1440 px | 663 | 319 | -52% |
| compare | 1440 px | 1038 | 274 | -74% |
| simulator | 390 px | 920 | 507 | -45% |
| rider | 390 px | 152 | 102 | -33% |
| audit | 390 px | 646 | 308 | -52% |
| compare | 390 px | 1021 | 263 | -74% |

Note on the Audit Log: it now loads 20 decisions per page instead of 50 ("Load more" fetches the rest), which
accounts for part of its drop.
