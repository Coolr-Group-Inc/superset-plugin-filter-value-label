// Based on the Apache Superset native filter Select plugin.
import {
  AppSection,
  Behavior,
  ChartProps,
  DataRecord,
  FilterState,
  QueryFormData,
  ChartDataResponseResult,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { RefObject } from 'react';
import { SetDataMaskHook } from '@superset-ui/core';

export type SelectValue = (number | string | null)[] | null | undefined;

export interface PluginFilterStylesProps {
  height: number;
  width: number;
  orientation?: FilterBarOrientation;
  overflow?: boolean;
}

export interface PluginFilterHooks {
  setDataMask: SetDataMaskHook;
  setFocusedFilter: () => void;
  unsetFocusedFilter: () => void;
  setHoveredFilter: () => void;
  unsetHoveredFilter: () => void;
  setFilterActive: (isActive: boolean) => void;
}

export enum FilterBarOrientation {
  Vertical = 'VERTICAL',
  Horizontal = 'HORIZONTAL',
}

export interface PluginFilterSelectCustomizeProps {
  defaultValue?: SelectValue;
  enableEmptyFilter: boolean;
  inverseSelection: boolean;
  creatable: boolean;
  multiSelect: boolean;
  defaultToFirstItem: boolean;
  defaultToFirstItemIfSingleOption: boolean;
  searchAllOptions: boolean;
  sortAscending?: boolean;
  sortMetric?: string;
  displayColumn?: string | null;
}

export type PluginFilterSelectQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterSelectCustomizeProps;

export interface PluginFilterSelectChartProps extends ChartProps {
  queriesData: ChartDataResponseResult[];
}

export type PluginFilterSelectProps = PluginFilterStylesProps & {
  coltypeMap: Record<string, GenericDataType>;
  data: DataRecord[];
  behaviors: Behavior[];
  appSection: AppSection;
  formData: PluginFilterSelectQueryFormData;
  filterState: FilterState;
  isRefreshing: boolean;
  showOverflow: boolean;
  parentRef?: RefObject<any>;
  inputRef?: RefObject<any>;
  filterBarOrientation?: FilterBarOrientation;
  isOverflowingFilterBar?: boolean;
  clearAllTrigger?: Record<string, boolean>;
  onClearAllComplete?: (filterId: string) => void;
} & PluginFilterHooks;

export const DEFAULT_FORM_DATA: PluginFilterSelectCustomizeProps = {
  defaultValue: null,
  enableEmptyFilter: false,
  inverseSelection: false,
  defaultToFirstItem: false,
  defaultToFirstItemIfSingleOption: false,
  creatable: true,
  multiSelect: true,
  searchAllOptions: false,
  sortAscending: true,
  displayColumn: null,
};

export enum ExpressionTypes {
  Simple = 'SIMPLE',
  Sql = 'SQL',
}

export enum Clauses {
  Having = 'HAVING',
  Where = 'WHERE',
}
