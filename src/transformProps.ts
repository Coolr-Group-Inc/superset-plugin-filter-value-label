// Based on the Apache Superset native filter Select plugin.
import { GenericDataType } from '@apache-superset/core/common';
import { DEFAULT_FORM_DATA, PluginFilterSelectChartProps } from './types';

const noOp = () => {};

export default function transformProps(
  chartProps: PluginFilterSelectChartProps,
) {
  const {
    formData,
    height,
    hooks,
    queriesData,
    width,
    displaySettings,
    behaviors,
    appSection,
    filterState,
    isRefreshing,
    inputRef,
  } = chartProps;
  const newFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const {
    setDataMask = noOp,
    setHoveredFilter = noOp,
    unsetHoveredFilter = noOp,
    setFocusedFilter = noOp,
    unsetFocusedFilter = noOp,
    setFilterActive = noOp,
    clearAllTrigger,
    onClearAllComplete,
  } = hooks;
  const [queryData] = queriesData;
  const { colnames = [], coltypes = [], data = [] } = queryData || {};
  const coltypeMap: Record<string, GenericDataType> = colnames.reduce(
    (accumulator, item, index) => ({ ...accumulator, [item]: coltypes[index] }),
    {},
  );

  return {
    filterState,
    coltypeMap,
    appSection,
    width,
    behaviors,
    height,
    data,
    formData: newFormData,
    isRefreshing,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    inputRef,
    filterBarOrientation: displaySettings?.filterBarOrientation,
    isOverflowingFilterBar: displaySettings?.isOverflowingFilterBar,
    clearAllTrigger,
    onClearAllComplete,
  };
}
