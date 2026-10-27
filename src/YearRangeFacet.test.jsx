import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-intl-redux';
import configureStore from 'redux-mock-store';
import YearRangeFacet from './YearRangeFacet';

const mockStore = configureStore();

const facet = {
  '@id': 'f1',
  title: 'Published',
  field: { value: 'effective' },
};

// The two one-item searches the facet reads its scale from.
const loaded = (effective) => ({
  loaded: true,
  loading: false,
  items: [{ effective }],
});

const makeStore = (subrequests, blocks) =>
  mockStore({
    intl: { locale: 'en', messages: {} },
    content: { data: { '@id': 'http://localhost:3000/resources', blocks } },
    breadcrumbs: { root: '' },
    querystringsearch: { subrequests },
  });

const renderFacet = (props, subrequests, blocks) => {
  const store = makeStore(
    subrequests ?? {
      'year-range-f1-first': loaded('2020-03-01T00:00:00+00:00'),
      'year-range-f1-last': loaded('2025-11-12T00:00:00+00:00'),
    },
    blocks,
  );
  render(
    <Provider store={store}>
      <YearRangeFacet facet={facet} value={[null, null]} {...props} />
    </Provider>,
  );
  return store;
};

describe('YearRangeFacet', () => {
  it('queries whole years, leaving an end at the scale open', () => {
    expect(
      YearRangeFacet.valueToQuery({
        facet,
        value: ['2022-01-01', '2023-12-31 23:59:59'],
      }),
    ).toEqual({
      i: 'effective',
      o: 'plone.app.querystring.operation.date.between',
      v: ['2022-01-01', '2023-12-31 23:59:59'],
    });
    // The open side stops short of the catalog's 1969 "no date".
    expect(
      YearRangeFacet.valueToQuery({ facet, value: [null, '2023-12-31'] }).v,
    ).toEqual(['1970-01-02', '2023-12-31']);
    expect(YearRangeFacet.valueToQuery({ facet, value: [null, null] })).toBe(
      null,
    );
  });

  it('reads the scale from the first and last dated result', () => {
    const store = renderFacet({
      searchQuery: {
        query: [
          {
            i: 'portal_type',
            o: 'plone.app.querystring.operation.selection.any',
            v: ['Publication'],
          },
        ],
      },
    });
    expect(screen.getByText('2020 – 2025')).toBeTruthy();

    const [first, last] = store.getActions();
    expect(first.subrequest).toBe('year-range-f1-first');
    expect(first.request.path).toBe('/resources/@querystring-search');
    expect(first.request.data).toMatchObject({
      sort_on: 'effective',
      sort_order: 'ascending',
      b_size: 1,
      metadata_fields: ['effective'],
    });
    expect(first.request.data.query[1]).toEqual({
      i: 'effective',
      o: 'plone.app.querystring.operation.date.between',
      v: ['1970-01-02', '2498-12-31 23:59:59'],
    });
    expect(last.request.data.sort_order).toBe('descending');
  });

  it('finds the search block query saved on the page', () => {
    const query = [
      {
        i: 'portal_type',
        o: 'plone.app.querystring.operation.selection.any',
        v: ['News Item'],
      },
    ];
    const store = renderFacet({}, undefined, {
      grid: {
        '@type': 'gridBlock',
        blocks: {
          search: { '@type': 'search', facets: [facet], query: { query } },
        },
      },
    });
    expect(store.getActions()[0].request.data.query[0]).toEqual(query[0]);
  });

  it('holds the place without a scale until both ends are back', () => {
    renderFacet({}, {});
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
  });

  it('shows the range and searches once a handle settles', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    renderFacet({ onChange });

    const [from] = screen.getAllByRole('slider');
    fireEvent.change(from, { target: { value: '2022' } });
    expect(screen.getByText('2022 – 2025', { selector: 'span' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    act(() => jest.runAllTimers());
    expect(onChange).toHaveBeenCalledWith('effective', ['2022-01-01', null]);
    jest.useRealTimers();
  });

  it('reads a range restored from the URL back onto the scale', () => {
    renderFacet({ value: ['1970-01-02', '2023-12-31 23:59:59'] });
    expect(screen.getByText('2020 – 2023', { selector: 'span' })).toBeTruthy();
  });
});
