import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import YearRangeFacet from './YearRangeFacet';

const facet = {
  '@id': 'f1',
  title: 'Published',
  field: { value: 'effective' },
  firstYear: 2020,
  lastYear: 2025,
};

const renderFacet = (props) =>
  render(
    <IntlProvider locale="en">
      <YearRangeFacet facet={facet} value={[null, null]} {...props} />
    </IntlProvider>,
  );

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
    expect(
      YearRangeFacet.valueToQuery({ facet, value: [null, '2023-12-31'] }).v,
    ).toEqual(['1900-01-01', '2023-12-31']);
    expect(YearRangeFacet.valueToQuery({ facet, value: [null, null] })).toBe(
      null,
    );
  });

  it('shows the range and searches once a handle settles', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    renderFacet({ onChange });
    expect(screen.getByText('All years')).toBeTruthy();

    const [from] = screen.getAllByRole('slider');
    fireEvent.change(from, { target: { value: '2022' } });
    expect(screen.getByText('2022 or later')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    act(() => jest.runAllTimers());
    expect(onChange).toHaveBeenCalledWith('effective', ['2022-01-01', null]);
    jest.useRealTimers();
  });

  it('reads a range restored from the URL back onto the scale', () => {
    renderFacet({ value: ['1900-01-01', '2023-12-31 23:59:59'] });
    expect(screen.getByText('2023 or earlier')).toBeTruthy();
  });
});
