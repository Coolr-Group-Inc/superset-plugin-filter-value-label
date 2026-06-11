// Based on the Apache Superset native filter Select plugin.
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core/translation';
import {
  AppSection,
  DataMask,
  ensureIsArray,
  ExtraFormData,
  getColumnLabel,
  JsonObject,
} from '@superset-ui/core';
import { tn } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  FormItem,
  LabeledValue,
  Select,
  Space,
  Constants,
} from '@superset-ui/core/components';
import {
  hasOption,
  propertyComparator,
} from '@superset-ui/core/components/Select/utils';
import {
  FilterBarOrientation,
  PluginFilterSelectProps,
  PluginFilterStylesProps,
  SelectValue,
  ExpressionTypes,
  Clauses,
} from './types';
import { debounce } from './utils';

const RESPONSIVE_WIDTH = 0;

const getSelectExtraFormData = (
  col: string,
  value?: null | (string | number | boolean | null)[],
  emptyFilter = false,
  shouldExcludeFilter = false,
): ExtraFormData => {
  const extra: ExtraFormData = {};
  if (emptyFilter) {
    extra.adhoc_filters = [
      {
        expressionType: ExpressionTypes.Sql,
        clause: Clauses.Where,
        sqlExpression: '1 = 0',
      },
    ];
  } else if (value !== undefined && value !== null && value.length !== 0) {
    extra.filters = [
      {
        col,
        op: shouldExcludeFilter ? ('NOT IN' as const) : ('IN' as const),
        val: value,
      },
    ];
  }
  return extra;
};

const StatusMessage = styled.div<{
  status?: 'error' | 'warning' | 'info' | 'help';
  centerText?: boolean;
}>`
  color: ${({ theme, status = 'error' }) => {
    if (status === 'help') {
      return theme.colorTextSecondary;
    }
    switch (status) {
      case 'error':
        return theme.colorError;
      case 'warning':
        return theme.colorWarning;
      case 'info':
        return theme.colorInfo;
      default:
        return theme.colorError;
    }
  }};
  text-align: ${({ centerText }) => (centerText ? 'center' : 'left')};
  width: 100%;
`;

const FilterPluginStyle = styled.div<PluginFilterStylesProps>`
  min-height: ${({ height }) => height}px;
  width: ${({ width }) => (width === RESPONSIVE_WIDTH ? '100%' : `${width}px`)};
`;

type DataMaskAction =
  | { type: 'ownState'; ownState: JsonObject }
  | {
      type: 'filterState';
      extraFormData: ExtraFormData;
      filterState: {
        value: SelectValue;
        label?: string;
        excludeFilterValues?: boolean;
      };
    };

function reducer(state: DataMask, action: DataMaskAction): DataMask {
  switch (action.type) {
    case 'ownState':
      return { ...state, ownState: { ...state.ownState, ...action.ownState } };
    case 'filterState': {
      const extraFormData =
        JSON.stringify(state.extraFormData) !==
        JSON.stringify(action.extraFormData)
          ? action.extraFormData
          : state.extraFormData;
      const filterState =
        JSON.stringify(state.filterState) !== JSON.stringify(action.filterState)
          ? { ...state.filterState, ...action.filterState }
          : state.filterState;
      return { ...state, extraFormData, filterState };
    }
    default:
      return state;
  }
}

const StyledSpace = styled(Space)<{
  inverseSelection: boolean;
  appSection: AppSection;
}>`
  display: flex;
  align-items: center;
  width: 100%;

  .exclude-select {
    width: 80px;
    flex-shrink: 0;
  }

  &.ant-space {
    .ant-space-item {
      width: ${({ inverseSelection }) => (!inverseSelection ? '100%' : 'auto')};
    }
  }
`;

// Keep track of orientation changes outside component with filter ID
const orientationMap = new Map<string, FilterBarOrientation>();

export default function PluginFilterSelect(props: PluginFilterSelectProps) {
  const {
    coltypeMap,
    data,
    filterState,
    formData,
    height,
    isRefreshing,
    width,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    appSection,
    showOverflow,
    parentRef,
    inputRef,
    filterBarOrientation,
    clearAllTrigger,
    onClearAllComplete,
  } = props;
  const {
    enableEmptyFilter,
    creatable,
    multiSelect,
    showSearch,
    inverseSelection,
    defaultToFirstItem,
    defaultToFirstItemIfSingleOption,
    searchAllOptions,
  } = formData;

  const groupby = useMemo(
    () => ensureIsArray(formData.groupby).map(getColumnLabel),
    [formData.groupby],
  );
  const [col] = groupby;
  // displayColumn is configured separately; falls back to undefined (show raw values)
  const displayCol = formData.displayColumn || undefined;

  // Maps each value to its display label when a display column is configured.
  const valueLabelMap = useMemo<Record<string, string>>(() => {
    if (!displayCol) return {};
    return data.reduce<Record<string, string>>((acc, row) => {
      const val = String(row[col]);
      if (!(val in acc)) {
        acc[val] = String(row[displayCol] ?? row[col]);
      }
      return acc;
    }, {});
  }, [data, col, displayCol]);

  const [initialColtypeMap] = useState(coltypeMap);
  const [search, setSearch] = useState('');
  const prevDataRef = useRef(data);
  const [dataMask, dispatchDataMask] = useReducer(reducer, {
    extraFormData: {},
    filterState,
  });
  const [excludeFilterValues, setExcludeFilterValues] = useState(
    filterState?.excludeFilterValues === undefined
      ? true
      : filterState?.excludeFilterValues,
  );

  const prevExcludeFilterValues = useRef(excludeFilterValues);
  const hasOnlyOrientationChanged = useRef(false);

  useEffect(() => {
    const previousOrientation = orientationMap.get(formData.nativeFilterId);
    if (
      previousOrientation !== undefined &&
      previousOrientation !== filterBarOrientation
    ) {
      hasOnlyOrientationChanged.current = true;
    } else {
      hasOnlyOrientationChanged.current = false;
    }
    if (filterBarOrientation) {
      orientationMap.set(formData.nativeFilterId, filterBarOrientation);
    }
  }, [filterBarOrientation]);

  const updateDataMask = useCallback(
    (values: SelectValue) => {
      const emptyFilter =
        enableEmptyFilter && !inverseSelection && !values?.length;

      const suffix = inverseSelection && values?.length ? t(' (excluded)') : '';
      const displayLabel = values?.length
        ? values
            .map(v => (displayCol ? (valueLabelMap[String(v)] ?? v) : v))
            .join(', ') + suffix
        : undefined;

      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          col,
          values,
          emptyFilter,
          excludeFilterValues && inverseSelection,
        ),
        filterState: {
          ...filterState,
          label: displayLabel,
          value:
            appSection === AppSection.FilterConfigModal &&
            (defaultToFirstItem || defaultToFirstItemIfSingleOption)
              ? undefined
              : values,
          excludeFilterValues,
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      appSection,
      col,
      displayCol,
      defaultToFirstItem,
      dispatchDataMask,
      enableEmptyFilter,
      inverseSelection,
      excludeFilterValues,
      valueLabelMap,
      JSON.stringify(filterState),
    ],
  );

  const isDisabled =
    appSection === AppSection.FilterConfigModal &&
    (defaultToFirstItem || defaultToFirstItemIfSingleOption);

  const onSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSearch(search);
        if (searchAllOptions) {
          dispatchDataMask({
            type: 'ownState',
            ownState: { coltypeMap: initialColtypeMap, search },
          });
        }
      }, Constants.SLOW_DEBOUNCE),
    [dispatchDataMask, initialColtypeMap, searchAllOptions],
  );

  const handleBlur = useCallback(() => {
    unsetFocusedFilter();
    onSearch('');
  }, [onSearch, unsetFocusedFilter]);

  const handleChange = useCallback(
    (value?: SelectValue | number | string) => {
      const values = value === null ? [null] : ensureIsArray(value);
      if (values.length === 0) {
        updateDataMask(null);
      } else {
        updateDataMask(values);
      }
    },
    [updateDataMask, formData.nativeFilterId, clearAllTrigger],
  );

  const placeholderText =
    data.length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);

  const formItemExtra = useMemo(() => {
    if (filterState.validateMessage) {
      return (
        <StatusMessage status={filterState.validateStatus}>
          {filterState.validateMessage}
        </StatusMessage>
      );
    }
    return undefined;
  }, [filterState.validateMessage, filterState.validateStatus]);

  // The GroupBy query deduplicates rows at the DB level, so data rows are
  // already unique by value column. Display label comes from groupby[1] when
  // configured, otherwise falls back to the value itself.
  const options = useMemo(
    () =>
      data.map(el => ({
        value: el[col] as string,
        label: displayCol ? String(el[displayCol] ?? el[col]) : (el[col] as string),
        isNewOption: false,
      })),
    [data, col, displayCol],
  );

  const visibleOptions = useMemo(() => {
    if (search && !multiSelect && !hasOption(search, options, true)) {
      return [{ label: search, value: search, isNewOption: true }, ...options];
    }
    return options;
  }, [multiSelect, search, options]);

  const sortComparator = useCallback(
    (a: LabeledValue, b: LabeledValue) => {
      if (formData.sortMetric) {
        return 0;
      }
      const labelComparator = propertyComparator('label');
      if (formData.sortAscending) {
        return labelComparator(a, b);
      }
      return labelComparator(b, a);
    },
    [formData.sortAscending, formData.sortMetric],
  );

  useEffect(() => {
    if (hasOnlyOrientationChanged.current) return;

    if (isDisabled) {
      updateDataMask(null);
      return;
    }

    if (filterState.value !== undefined) {
      updateDataMask(filterState.value);
      return;
    }

    if (!clearAllTrigger) {
      if (defaultToFirstItem) {
        const firstItem: SelectValue = data[0] ? [data[0][col] as string] : null;
        if (firstItem?.[0] !== undefined) {
          updateDataMask(firstItem);
        }
      } else if (defaultToFirstItemIfSingleOption && data.length === 1) {
        const onlyItem: SelectValue = [data[0][col] as string];
        if (onlyItem?.[0] !== undefined) {
          updateDataMask(onlyItem);
        }
      } else if (formData?.defaultValue) {
        updateDataMask(formData.defaultValue);
      }
    }
  }, [
    isDisabled,
    enableEmptyFilter,
    defaultToFirstItem,
    defaultToFirstItemIfSingleOption,
    formData?.defaultValue,
    data,
    col,
    inverseSelection,
    clearAllTrigger,
  ]);

  useEffect(() => {
    const prev = prevDataRef.current;
    const curr = data;
    const hasDataChanged =
      prev?.length !== curr?.length ||
      prev?.some((row, i) => {
        const prevVal = row[col];
        const currVal = curr[i][col];
        return typeof prevVal === 'bigint' || typeof currVal === 'bigint'
          ? prevVal?.toString() !== currVal?.toString()
          : prevVal !== currVal;
      });
    if (hasDataChanged) {
      prevDataRef.current = data;
    }
  }, [data, col]);

  useEffect(() => {
    if (
      filterState.value?.every((value?: any) =>
        data.some(row => row[col] === value),
      )
    )
      return;

    const firstItem: SelectValue = data[0] ? [data[0][col] as string] : null;

    if (!clearAllTrigger && Object.keys(formData?.extraFormData || {}).length) {
      if (
        defaultToFirstItem &&
        filterState.value !== undefined &&
        firstItem !== null &&
        filterState.value !== firstItem
      ) {
        if (firstItem?.[0] !== undefined) {
          updateDataMask(firstItem);
        }
      } else if (defaultToFirstItemIfSingleOption && data.length === 1) {
        const onlyItem: SelectValue = [data[0][col] as string];
        if (onlyItem?.[0] !== undefined) {
          updateDataMask(onlyItem);
        }
      } else if (
        defaultToFirstItemIfSingleOption &&
        data.length !== 1 &&
        filterState.value !== undefined
      ) {
        updateDataMask(null);
      }
    }
  }, [
    defaultToFirstItem,
    defaultToFirstItemIfSingleOption,
    updateDataMask,
    formData,
    data,
    JSON.stringify(filterState.value),
    clearAllTrigger,
  ]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  useEffect(() => {
    if (clearAllTrigger) {
      dispatchDataMask({
        type: 'filterState',
        extraFormData: {},
        filterState: {
          value: undefined,
          label: undefined,
        },
      });
      updateDataMask(null);
      setSearch('');
      onClearAllComplete?.(formData.nativeFilterId);
    }
  }, [clearAllTrigger, onClearAllComplete, updateDataMask]);

  useEffect(() => {
    if (prevExcludeFilterValues.current !== excludeFilterValues) {
      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          col,
          filterState.value,
          !filterState.value?.length,
          excludeFilterValues && inverseSelection,
        ),
        filterState: {
          ...(filterState as {
            value: SelectValue;
            label?: string;
            excludeFilterValues?: boolean;
          }),
          excludeFilterValues,
        },
      });
      prevExcludeFilterValues.current = excludeFilterValues;
    }
  }, [excludeFilterValues]);

  const handleExclusionToggle = (value: string) => {
    setExcludeFilterValues(value === 'true');
  };

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem
        validateStatus={filterState.validateStatus}
        extra={formItemExtra}
      >
        <StyledSpace
          appSection={appSection}
          inverseSelection={inverseSelection}
        >
          {appSection !== AppSection.FilterConfigModal && inverseSelection && (
            <Select
              className="exclude-select"
              value={`${excludeFilterValues}`}
              options={[
                { value: 'true', label: t('is not') },
                { value: 'false', label: t('is') },
              ]}
              onChange={handleExclusionToggle}
            />
          )}
          <Select
            name={formData.nativeFilterId}
            allowClear
            autoClearSearchValue
            allowNewOptions={!searchAllOptions && creatable !== false}
            allowSelectAll={!searchAllOptions}
            value={multiSelect ? filterState.value || [] : filterState.value}
            disabled={isDisabled}
            getPopupContainer={
              showOverflow
                ? () => (parentRef?.current as HTMLElement) || document.body
                : (trigger: HTMLElement) =>
                    (trigger?.parentNode as HTMLElement) || document.body
            }
            showSearch={showSearch}
            mode={multiSelect ? 'multiple' : 'single'}
            placeholder={placeholderText}
            onClear={() => onSearch('')}
            onSearch={onSearch}
            onBlur={handleBlur}
            onFocus={setFocusedFilter}
            onMouseEnter={setHoveredFilter}
            onMouseLeave={unsetHoveredFilter}
            // @ts-expect-error
            onChange={handleChange}
            ref={inputRef}
            loading={isRefreshing}
            oneLine={filterBarOrientation === FilterBarOrientation.Horizontal}
            invertSelection={inverseSelection && excludeFilterValues}
            options={visibleOptions}
            sortComparator={sortComparator}
            onOpenChange={setFilterActive}
            className="select-container"
          />
        </StyledSpace>
      </FormItem>
    </FilterPluginStyle>
  );
}
