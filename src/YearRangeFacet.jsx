import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Header, Label, Icon } from 'semantic-ui-react';
import { defineMessages, useIntl } from 'react-intl';
import { getQueryStringResults } from '@plone/volto/actions/querystringsearch/querystringsearch';
import { flattenToAppURL } from '@plone/volto/helpers/Url/Url';

import './YearRangeFacet.css';

// Replaces the Date Range facet's calendar picker with a two-handle slider
// that picks whole years. The facet keeps the `date.between` query and its
// `[start, end]` value, so URLs and saved search blocks keep working. The
// scale runs from the earliest to the latest year in the search block's
// results before any filter is picked, so it fits whatever the block lists.

// Stand-in dates for a handle left at the end of the scale, so the filter
// stays open on that side and still catches items dated after the scale was
// read. They stop short of the catalog's own stand-ins for "no date", so
// picking years leaves out unpublished items.
const OPEN_START = '1970-01-02';
const OPEN_END = '2498-12-31 23:59:59';

const BETWEEN = 'plone.app.querystring.operation.date.between';
const ABSOLUTE_PATH = 'plone.app.querystring.operation.string.absolutePath';

// How long the slider waits after the last move before searching, so a drag
// runs one search instead of one per year passed.
const COMMIT_DELAY = 400;

const messages = defineMessages({
  from: {
    id: 'From year',
    defaultMessage: 'From',
  },
  to: {
    id: 'To year',
    defaultMessage: 'To',
  },
  orEarlier: {
    id: '{year} or earlier',
    defaultMessage: '{year} or earlier',
  },
  orLater: {
    id: '{year} or later',
    defaultMessage: '{year} or later',
  },
});

const toInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
};

const yearOf = (date) =>
  typeof date === 'string' ? toInt(date.slice(0, 4)) : null;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// The catalog stores 1969-12-31 for an item with no publication date (one
// that isn't published yet) and 2499-12-31 for one that never expires.
const datedYear = (date) => {
  const year = yearOf(date);
  return year === null || year <= 1970 || year >= 2499 ? null : year;
};

// The query of the search block holding this facet, from the page's saved
// blocks, including blocks nested in containers.
const findSearchQuery = (blocks, facetId) => {
  for (const block of Object.values(blocks || {})) {
    if (block?.facets?.some((f) => f?.['@id'] === facetId)) return block.query;
    const nested =
      findSearchQuery(block?.blocks, facetId) ??
      findSearchQuery(block?.data?.blocks, facetId);
    if (nested) return nested;
  }
  return null;
};

// The first and last year in the search block's results, read with two
// one-item searches sorted each way on the facet's field. Returns null until
// both are back. With `load: false` it only reads what the facet loaded.
// Without a `searchQuery` it uses the one saved on the page.
export const useYearBounds = (facet, searchQuery, { load = true } = {}) => {
  const dispatch = useDispatch();
  const field = facet?.field?.value;
  const id = `year-range-${facet?.['@id']}`;
  const path = useSelector((state) =>
    flattenToAppURL(state.content.data?.['@id'] || ''),
  );
  const root = useSelector((state) => state.breadcrumbs.root);
  const savedQuery = useSelector((state) =>
    searchQuery
      ? null
      : findSearchQuery(state.content.data?.blocks, facet?.['@id']),
  );
  const blockQuery = searchQuery ?? savedQuery;
  const first = useSelector(
    (state) => state.querystringsearch.subrequests[`${id}-first`],
  );
  const last = useSelector(
    (state) => state.querystringsearch.subrequests[`${id}-last`],
  );

  // The query the search block runs before any filter is picked.
  const base = blockQuery?.query?.length
    ? blockQuery.query
    : [{ i: 'path', o: ABSOLUTE_PATH, v: root || '/' }];
  const queryKey = JSON.stringify(base);

  useEffect(() => {
    if (!load || !field) return;
    // Undated items would otherwise pull the scale back to 1969.
    const query = base.some((c) => c.i === field)
      ? base
      : [...base, { i: field, o: BETWEEN, v: [OPEN_START, OPEN_END] }];
    ['first', 'last'].forEach((end) =>
      dispatch(
        getQueryStringResults(
          path,
          {
            query,
            sort_on: field,
            sort_order: end === 'first' ? 'ascending' : 'descending',
            b_size: 1,
            metadata_fields: [field],
          },
          `${id}-${end}`,
        ),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, field, id, path, queryKey]);

  const done = (r) => r && !r.loading && (r.loaded || r.error);
  if (!done(first) || !done(last)) return null;
  const year = (r) => datedYear(r.items?.[0]?.[field]);
  const max = year(last) ?? new Date().getFullYear();
  return [Math.min(year(first) ?? max, max), max];
};

// The facet value is `[startDate, endDate]`, either side null when open.
const valueToYears = (value, min, max) => {
  const start = yearOf(value?.[0]);
  const end = yearOf(value?.[1]);
  return [
    start === null ? min : clamp(start, min, max),
    end === null ? max : clamp(end, min, max),
  ];
};

const yearsToValue = ([start, end], min, max) => {
  if (start <= min && end >= max) return null;
  return [
    start <= min ? null : `${start}-01-01`,
    end >= max ? null : `${end}-12-31 23:59:59`,
  ];
};

// Which years get a label under the scale: every one when they fit, else a
// regular step that always includes both ends.
const labelledYears = (min, max) => {
  const span = max - min;
  const step = span <= 8 ? 1 : Math.ceil(span / 6);
  const years = new Set([min, max]);
  for (let y = min; y < max; y += step) years.add(y);
  // Drop a label that would crowd the last one.
  if (step > 1 && (max - min) % step !== 0 && (max - min) % step < step / 2) {
    years.delete(max - ((max - min) % step));
  }
  return years;
};

const describe = ([start, end]) =>
  start === end ? `${start}` : `${start} – ${end}`;

// For the filter list when the scale isn't loaded: an open side reads as
// "or earlier" or "or later".
const describeValue = (intl, value) => {
  const start = yearOf(value[0]);
  const end = yearOf(value[1]);
  if (start === null || start <= 1970)
    return intl.formatMessage(messages.orEarlier, { year: end });
  if (end === null || end >= 2498)
    return intl.formatMessage(messages.orLater, { year: start });
  return describe([start, end]);
};

const YearRangeFacet = (props) => {
  const { facet, isEditMode, onChange, value, searchQuery } = props;
  const intl = useIntl();
  const bounds = useYearBounds(facet, searchQuery);
  const [min, max] = bounds ?? [0, 0];
  const [years, setYears] = useState(() => valueToYears(value, min, max));
  // The handle last moved sits on top, so two handles on the same year can
  // still be pulled apart.
  const [active, setActive] = useState('end');
  const timer = useRef(null);

  const valueKey = JSON.stringify(value);
  useEffect(() => {
    setYears(valueToYears(value, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey, min, max]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (next) => {
    setYears(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onChange(facet.field.value, yearsToValue(next, min, max));
    }, COMMIT_DELAY);
  };

  const title = facet?.title ?? facet?.field?.label;

  if (!bounds) {
    // Holds the slider's place while the scale loads.
    return (
      <div className="daterange-facet year-range-facet">
        <div className="year-range-heading">
          <Header as="h4">{title}</Header>
        </div>
        <div className="year-range-slider" aria-hidden="true">
          <div className="year-range-track" />
        </div>
        <div className="year-range-scale" aria-hidden="true" />
      </div>
    );
  }

  const [start, end] = years;
  const span = Math.max(max - min, 1);
  const pct = (y) => ((y - min) / span) * 100;
  const labels = labelledYears(min, max);
  const ticks = [];
  for (let y = min; y <= max; y++) ticks.push(y);

  // Bubbles close enough to overlap merge into one over the middle.
  const merged = (end - start) / span < 0.2;

  return (
    <div className="daterange-facet year-range-facet">
      <div className="year-range-heading">
        <Header as="h4">{title}</Header>
        <span className="year-range-summary" aria-live="polite">
          {describe(years)}
        </span>
      </div>
      <div
        className="year-range-slider"
        style={{
          '--year-range-start': `${pct(start)}%`,
          '--year-range-end': `${pct(end)}%`,
        }}
      >
        <div className="year-range-track" aria-hidden="true">
          <div className="year-range-fill" />
        </div>
        {merged ? (
          <span
            className="year-range-bubble"
            style={{ left: `${(pct(start) + pct(end)) / 2}%` }}
            aria-hidden="true"
          >
            {describe(years)}
          </span>
        ) : (
          <>
            <span
              className="year-range-bubble"
              style={{ left: `${pct(start)}%` }}
              aria-hidden="true"
            >
              {start}
            </span>
            <span
              className="year-range-bubble"
              style={{ left: `${pct(end)}%` }}
              aria-hidden="true"
            >
              {end}
            </span>
          </>
        )}
        <input
          type="range"
          className={`year-range-input${active === 'start' ? ' active' : ''}`}
          min={min}
          max={max}
          step={1}
          value={start}
          disabled={isEditMode}
          aria-label={`${title}: ${intl.formatMessage(messages.from)}`}
          onPointerDown={() => setActive('start')}
          onFocus={() => setActive('start')}
          onChange={(e) => update([Math.min(+e.target.value, end), end])}
        />
        <input
          type="range"
          className={`year-range-input${active === 'end' ? ' active' : ''}`}
          min={min}
          max={max}
          step={1}
          value={end}
          disabled={isEditMode}
          aria-label={`${title}: ${intl.formatMessage(messages.to)}`}
          onPointerDown={() => setActive('end')}
          onFocus={() => setActive('end')}
          onChange={(e) => update([start, Math.max(+e.target.value, start)])}
        />
      </div>
      <div className="year-range-scale" aria-hidden="true">
        {ticks.map((y) => (
          <span
            key={y}
            className={`year-range-tick${
              y >= start && y <= end ? ' in-range' : ''
            }${labels.has(y) ? ' labelled' : ''}`}
            style={{ left: `${pct(y)}%` }}
          >
            {labels.has(y) && <span className="year-range-label">{y}</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

YearRangeFacet.stateToValue = ({ selectedValue }) =>
  Array.isArray(selectedValue) ? selectedValue : [null, null];

YearRangeFacet.valueToQuery = ({ value, facet }) => {
  if (!Array.isArray(value) || (!value[0] && !value[1])) return null;
  return {
    i: facet.field.value,
    o: BETWEEN,
    v: [value[0] || OPEN_START, value[1] || OPEN_END],
  };
};

export const YearRangeFacetFilterListEntry = (props) => {
  const { facet, facets, setFacets, isEditMode, data } = props;
  const intl = useIntl();
  const settings = data?.facets?.find((f) => f?.field?.value === facet);
  const bounds = useYearBounds(settings, data?.query, { load: false });
  const value = facets[facet];
  if (!Array.isArray(value) || (!value[0] && !value[1])) return null;

  return (
    <Label size="small">
      {bounds
        ? describe(valueToYears(value, ...bounds))
        : describeValue(intl, value)}
      <Icon
        name="delete"
        onClick={() => !isEditMode && setFacets({ ...facets, [facet]: null })}
      />
    </Label>
  );
};

export default YearRangeFacet;
