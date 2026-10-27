import React, { useEffect, useRef, useState } from 'react';
import { Header, Label, Icon } from 'semantic-ui-react';
import { defineMessages, useIntl } from 'react-intl';

import './YearRangeFacet.css';

// Replaces the Date Range facet's calendar picker with a two-handle slider
// that picks whole years. The facet keeps the `date.between` query and its
// `[start, end]` value, so URLs and saved search blocks keep working.

// Stand-in dates for a handle left at the end of the scale, so the filter
// stays open on that side and still catches items outside the scale.
const OPEN_START = '1900-01-01';
const OPEN_END = '2999-12-31 23:59:59';

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
  allYears: {
    id: 'All years',
    defaultMessage: 'All years',
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

const currentYear = () => new Date().getFullYear();

const toInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
};

export const getYearBounds = (facet) => {
  const max = toInt(facet?.lastYear) ?? currentYear();
  const min = Math.min(toInt(facet?.firstYear) ?? max - 10, max);
  return [min, max];
};

const yearOf = (date) =>
  typeof date === 'string' ? toInt(date.slice(0, 4)) : null;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

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

const describe = (intl, [start, end], min, max) => {
  if (start <= min && end >= max) return intl.formatMessage(messages.allYears);
  if (start <= min)
    return intl.formatMessage(messages.orEarlier, { year: end });
  if (end >= max) return intl.formatMessage(messages.orLater, { year: start });
  return start === end ? `${start}` : `${start} – ${end}`;
};

const YearRangeFacet = (props) => {
  const { facet, isEditMode, onChange, value } = props;
  const intl = useIntl();
  const [min, max] = getYearBounds(facet);
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

  const [start, end] = years;
  const span = Math.max(max - min, 1);
  const pct = (y) => ((y - min) / span) * 100;
  const labels = labelledYears(min, max);
  const ticks = [];
  for (let y = min; y <= max; y++) ticks.push(y);

  const title = facet?.title ?? facet?.field?.label;
  const isOpenStart = start <= min;
  const isOpenEnd = end >= max;

  // Bubbles close enough to overlap merge into one over the middle.
  const merged = (end - start) / span < 0.2;

  return (
    <div className="daterange-facet year-range-facet">
      <div className="year-range-heading">
        <Header as="h4">{title}</Header>
        <span className="year-range-summary" aria-live="polite">
          {describe(intl, years, min, max)}
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
            {start === end ? start : `${start} – ${end}`}
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
          aria-valuetext={
            isOpenStart
              ? intl.formatMessage(messages.orEarlier, { year: start })
              : `${start}`
          }
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
          aria-valuetext={
            isOpenEnd
              ? intl.formatMessage(messages.orLater, { year: end })
              : `${end}`
          }
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

// Volto passes the enhancer no intl, so the field labels stay in English like
// the rest of the facet settings.
YearRangeFacet.schemaEnhancer = ({ schema }) => {
  const pos = schema.fieldsets[0].fields.indexOf('type') + 1;
  schema.fieldsets[0].fields.splice(pos, 0, 'firstYear', 'lastYear');
  schema.properties.firstYear = {
    title: 'First year',
    description:
      'The earliest year on the slider. Leave the handle at this end to include everything older too.',
    type: 'integer',
    default: currentYear() - 10,
  };
  schema.properties.lastYear = {
    title: 'Last year',
    description:
      'The latest year on the slider. Leave empty to use the current year.',
    type: 'integer',
  };
  return schema;
};

YearRangeFacet.stateToValue = ({ selectedValue }) =>
  Array.isArray(selectedValue) ? selectedValue : [null, null];

YearRangeFacet.valueToQuery = ({ value, facet }) => {
  if (!Array.isArray(value) || (!value[0] && !value[1])) return null;
  return {
    i: facet.field.value,
    o: 'plone.app.querystring.operation.date.between',
    v: [value[0] || OPEN_START, value[1] || OPEN_END],
  };
};

export const YearRangeFacetFilterListEntry = (props) => {
  const { facet, facets, setFacets, isEditMode, data } = props;
  const intl = useIntl();
  const settings = data?.facets?.find((f) => f?.field?.value === facet);
  const [min, max] = getYearBounds(settings);
  const value = facets[facet];
  if (!Array.isArray(value) || (!value[0] && !value[1])) return null;

  return (
    <Label size="small">
      {describe(intl, valueToYears(value, min, max), min, max)}
      <Icon
        name="delete"
        onClick={() => !isEditMode && setFacets({ ...facets, [facet]: null })}
      />
    </Label>
  );
};

export default YearRangeFacet;
