# Volto year range facet

A search block facet for [Volto](https://github.com/plone/volto) that filters by
year with a two-handle slider, instead of picking dates on a calendar. Drag the
handles to, say, 2024 and 2025 to show only items from those two years.

- **Whole years.** Each handle snaps to a year, and a bubble above it shows
  which one. Ticks mark every year, with labels spaced so they never crowd.
- **Open ends.** A handle left at either end of the scale leaves that side of
  the filter open, so "2022 or later" still includes this year's items, and
  older items aren't lost off the left end. Both handles at the ends means no
  filter at all.
- **One search per drag.** The search runs 0.4 seconds after a handle stops
  moving, not once for every year it passes.
- **Keyboard and screen reader friendly.** The handles are native range
  inputs, so arrow keys work and screen readers announce "2022", "2024 or
  later" and so on.
- **Drop-in for the Date Range facet.** It keeps the same `date.between` query
  and value, so search blocks already using a Date Range facet switch over
  without being re-edited, and links people have already shared keep working.

Tested with Volto 18. It uses only what Volto already ships (React,
`react-intl` and `semantic-ui-react`), so there's nothing extra to install.

## What's here

| File                      | What it is                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/YearRangeFacet.jsx`  | The facet, its settings and query, and the entry for the active filter list |
| `src/YearRangeFacet.css`  | Its styles, with colour tokens for matching your theme                     |
| `src/YearRangeFacet.test.jsx` | Jest tests for the query, the delayed search and restoring a range from the URL |

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

## Facet settings

The facet adds two settings below "Type" in the search block's facet editor:

- **First year**: the left end of the slider. Defaults to ten years ago. Set
  it to the year of your oldest content, so editors and visitors can see the
  whole range.
- **Last year**: the right end of the slider. Leave it empty to always use the
  current year, so the scale moves on by itself each January.

## How it works

The slider keeps its range as a pair of dates, the same shape the Date Range
facet uses:

| Slider shows      | Value sent to the search                    |
| ----------------- | ------------------------------------------- |
| 2024 – 2025       | `2024-01-01` to `2025-12-31 23:59:59`       |
| 2022 or later     | `2022-01-01` to `2999-12-31 23:59:59`       |
| 2020 or earlier   | `1900-01-01` to `2020-12-31 23:59:59`       |
| All years         | no filter                                   |

An open side is sent as a far-off stand-in date because Volto restores facets
from the query saved in the page URL. A one-sided query would come back as a
single date with no way to tell which side it was. When a range is restored,
any year outside the scale snaps to the nearest end, which is also how older
links from a calendar Date Range facet show up on the slider.

One side effect of open ends: setting the left handle exactly on the first
year means "that year or earlier", not "only from that year".

The active filter list above the results shows the range in words ("2024 –
2025", "2022 or later") with a button to clear it. Volto's own Date Range entry
shows "Yes" or "No" there.

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

The visitor-facing text ("All years", "{year} or later", "{year} or earlier",
"From", "To") goes through `react-intl`, so run your add-on's i18n script to
add it to your locales. The two settings in the facet editor are in English,
because Volto passes facet schema enhancers no `intl`.

## Running the tests

From your Volto project, with the files in your add-on:

```sh
pnpm test -- YearRangeFacet
```

## Licence

MIT. See [LICENSE](LICENSE).

Built by [Juizi](https://juizi.com) for the African Continental Qualifications
Framework site.
