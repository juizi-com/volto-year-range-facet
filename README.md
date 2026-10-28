# Volto year range facet

A search block facet for [Volto](https://github.com/plone/volto) that filters by
year with a two-handle slider, instead of picking dates on a calendar. Drag the
handles to, say, 2024 and 2025 to show only items from those two years.

- **A scale that fits the results.** The slider runs from the earliest to the
  latest year in the search block's results, so it never shows empty years
  and grows by itself when newer or older content is added.
- **Whole years.** Each handle snaps to a year, and a bubble above it shows
  which one. Labels sit on round years (2000, 2010, 2020) spaced to fit the
  facet's width, so a scale covering decades stays readable in a sidebar.
- **Open ends.** A handle left at either end of the scale leaves that side of
  the filter open, so items published after the page loaded aren't lost off
  the right end. Both handles at the ends means no filter at all.
- **Unpublished items left out.** Picking years never matches items without a
  publication date, which the catalog would otherwise file under 1969.
- **One search per drag.** The search runs 0.4 seconds after a handle stops
  moving, not once for every year it passes.
- **Keyboard and screen reader friendly.** The handles are native range
  inputs, so arrow keys work and screen readers announce each year.
- **Drop-in for the Date Range facet.** It keeps the same `date.between` query
  and value, so search blocks already using a Date Range facet switch over
  without being re-edited, and links people have already shared keep working.

Tested with Volto 18. It uses only what Volto already ships (React, Redux,
`react-intl`, `semantic-ui-react` and Volto's own search action), so there's
nothing extra to install.

## What's here

| File                      | What it is                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/YearRangeFacet.jsx`  | The facet, its scale and query, and the entry for the active filter list   |
| `src/YearRangeFacet.css`  | Its styles, with colour tokens for matching your theme                     |
| `src/YearRangeFacet.test.jsx` | Jest tests for the query, reading the scale, label and tick spacing, the Scale interval setting, the delayed search and restoring a range from the URL |

## Where it goes

1. Copy the three files from `src/` into your project's Volto add-on, for
   example to `src/components/YearRangeFacet/`.

2. Register it in your add-on's config, usually `src/index.js` or
   `src/index.ts`. Choose one of the two options below.

### Option A: replace the Date Range facet (recommended)

Every Date Range facet on the site becomes a year slider, including those in
search blocks that already exist.

```js
import YearRangeFacet, {
  YearRangeFacetFilterListEntry,
} from './components/YearRangeFacet/YearRangeFacet';

const applyConfig = (config) => {
  const dateRangeFacet =
    config.blocks.blocksConfig.search.extensions.facetWidgets.types.find(
      (type) => type.id === 'daterangeFacet',
    );
  Object.assign(dateRangeFacet, {
    title: 'Year range',
    view: YearRangeFacet,
    schemaEnhancer: YearRangeFacet.schemaEnhancer,
    stateToValue: YearRangeFacet.stateToValue,
    valueToQuery: YearRangeFacet.valueToQuery,
    filterListComponent: YearRangeFacetFilterListEntry,
  });

  return config;
};

export default applyConfig;
```

### Option B: add it next to the Date Range facet

Editors get a new "Year range" facet type and the calendar stays available.
Existing Date Range facets stay as calendars until an editor switches them.

```js
config.blocks.blocksConfig.search.extensions.facetWidgets.types.push({
  id: 'yearRangeFacet',
  title: 'Year range',
  view: YearRangeFacet,
  isDefault: false,
  schemaEnhancer: YearRangeFacet.schemaEnhancer,
  stateToValue: YearRangeFacet.stateToValue,
  valueToQuery: YearRangeFacet.valueToQuery,
  filterListComponent: YearRangeFacetFilterListEntry,
});
```

3. Restart Volto. In a search block, add a facet (or edit one), choose a date
   field such as "Effective date" or "Event start date", and set its type to
   "Year range".

## The scale

Editors don't set the scale's ends. When the facet loads, it runs two
one-item searches with the search block's own query, before any filter is
picked: one sorted oldest first on the facet's field and one newest first.
Their years become the ends of the slider. A track without handles holds the
slider's place until both come back.

Items with no date, which the catalog stores as 1969 for an unset
publication date and 2499 for an unset expiry, are left out of both searches,
so they can't stretch the scale.

The facet finds the search block's query in the page's saved blocks,
including blocks inside grids and other containers. While an editor is
changing that query, the scale follows the saved version until the page is
saved. To have it follow unsaved edits too, shadow Volto's search `Facets`
component and pass the block's query to each facet widget:

```jsx
<FacetWidget
  facet={facetSettings}
  searchQuery={data?.query}
  ...
/>
```

## Labels and ticks

Labels sit on multiples of an interval of 1, 2, 5, 10, 20, 25, 50 or 100
years, so they read as round years. The facet measures its own width and
uses the smallest interval that leaves each label about 45px, so a narrow
sidebar gets a coarser interval than a full-width column, and it adjusts
when the layout changes. Ticks thin out with the labels so they stay at
least 6px apart. The first and last year keep a label only when it won't
crowd a round one, since the bubbles over the handles already show the
years picked. The handles always move one year at a time.

For example, in a sidebar about 250px wide:

| Scale        | Labels                           | Ticks        |
| ------------ | -------------------------------- | ------------ |
| 2020 – 2025  | every year                       | every year   |
| 2015 – 2026  | 2016, 2018 … 2026                | every year   |
| 1994 – 2026  | 1994, 2000, 2010, 2020, 2026     | every year   |
| 1950 – 2026  | 1960, 1980, 2000, 2020           | every 2 years |

### Scale interval

Each facet has an optional **Scale interval** setting, under the facet
type, to fix the labels at every 1, 2, 5, 10 or 25 years. Left empty, the
scale fits itself. When the chosen interval's labels won't fit the width,
the facet uses the next wider interval so labels never overlap. Facets saved
before the setting existed have no value, so they keep the automatic scale.

The setting comes from `YearRangeFacet.schemaEnhancer`, registered with the
facet type as shown above.

#### With Volto Light Theme

Volto Light Theme replaces the `object_list` widget that holds a search
block's facets. Its version reads `schemaEnhancer` and ignores Volto's
`schemaExtender`, so no facet type can add its own settings and Scale
interval won't appear. To fix it, shadow Volto's
`components/manage/Blocks/Search/schema.js` and have the `facets` field set
both:

```js
facets: {
  title: intl.formatMessage(messages.facets),
  widget: 'object_list',
  schema: FacetSchema({ intl }),
  schemaExtender: enhanceSchema,
  schemaEnhancer: ({ schema, formData }) => enhanceSchema(schema, formData),
},
```

This also brings back Volto's Multiple choices option on Select and
Checkbox facets, which goes missing for the same reason.

## How it works

The slider keeps its range as a pair of dates, the same shape the Date Range
facet uses:

With a scale from 2019 to 2026:

| Handles on        | Value sent to the search                    |
| ----------------- | ------------------------------------------- |
| 2024 and 2025     | `2024-01-01` to `2025-12-31 23:59:59`       |
| 2022 and 2026     | `2022-01-01` to `2498-12-31 23:59:59`       |
| 2019 and 2020     | `1970-01-02` to `2020-12-31 23:59:59`       |
| 2019 and 2026     | no filter                                   |

An open side is sent as a far-off stand-in date because Volto restores facets
from the query saved in the page URL. A one-sided query would come back as a
single date with no way to tell which side it was. The stand-ins stop just
inside the catalog's 1969 and 2499 "no date" values, so undated items stay
out. When a range is restored, any year outside the scale snaps to the
nearest end, which is also how older links from a calendar Date Range facet
show up on the slider.

The active filter list above the results shows the range ("2024 – 2025") with
a button to clear it. Volto's own Date Range entry shows "Yes" or "No" there.

## Styling

The facet uses the class names Volto gives facets (`daterange-facet`), plus its
own `year-range-*` classes. Match it to your theme by setting these custom
properties on `.year-range-facet` or any parent:

| Property                         | Default            | Used for                              |
| -------------------------------- | ------------------ | ------------------------------------- |
| `--year-range-accent`            | `#1f2937`          | Filled track, handle borders, bubbles, labels |
| `--year-range-on-accent`         | `#fff`             | Text in the bubbles                   |
| `--year-range-thumb-background`  | `#fff`             | Inside of the handles                 |
| `--year-range-rail`              | accent at 18%      | Unfilled track and ticks outside the range |
| `--year-range-thumb`             | `22px`             | Handle size                           |

For example, with Volto Light Theme:

```css
.year-range-facet {
  --year-range-accent: var(--primary-foreground-color);
}
```

The default rail and focus ring colours use `color-mix()`, which all current
browsers support.

## Translations

The visitor-facing text ("From", "To", and "{year} or later" and "{year} or
earlier" for a filter list entry shown before the scale has loaded) goes
through `react-intl`, so run your add-on's i18n script to add it to your
locales.

## Running the tests

From your Volto project, with the files in your add-on:

```sh
pnpm test -- YearRangeFacet
```

## Licence

MIT. See [LICENSE](LICENSE).

Built by [Juizi](https://juizi.com) for the African Continental Qualifications
Framework site.
