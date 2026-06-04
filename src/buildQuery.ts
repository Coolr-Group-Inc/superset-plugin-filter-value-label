// Based on the Apache Superset native filter Select plugin.
import {
  buildQueryContext,
  getColumnLabel,
  isPhysicalColumn,
  QueryObject,
  QueryObjectFilterClause,
  BuildQuery,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { DEFAULT_FORM_DATA, PluginFilterSelectQueryFormData } from './types';

const buildQuery: BuildQuery<PluginFilterSelectQueryFormData> = (
  formData: PluginFilterSelectQueryFormData,
  options,
) => {
  const { search, coltypeMap } = options?.ownState || {};
  const { sortAscending, sortMetric, displayColumn } = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };
  return buildQueryContext(formData, baseQueryObject => {
    const { columns = [], filters = [] } = baseQueryObject;

    // Include the display column so both value and label arrive in query results.
    const allColumns =
      displayColumn && !columns.some(c => getColumnLabel(c) === displayColumn)
        ? [...columns, displayColumn]
        : columns;

    const extraFilters: QueryObjectFilterClause[] = [];
    if (search) {
      allColumns.filter(isPhysicalColumn).forEach(column => {
        const label = getColumnLabel(column);
        if (
          coltypeMap[label] === GenericDataType.String ||
          (coltypeMap[label] === GenericDataType.Numeric &&
            !Number.isNaN(Number(search)))
        ) {
          extraFilters.push({
            col: column,
            op: 'ILIKE',
            val: `%${search}%`,
          });
        }
      });
    }

    const sortColumns = sortMetric ? [sortMetric] : columns;
    const query: QueryObject[] = [
      {
        ...baseQueryObject,
        columns: allColumns,
        metrics: sortMetric ? [sortMetric] : [],
        filters: filters.concat(extraFilters),
        orderby:
          sortMetric || sortAscending !== undefined
            ? sortColumns.map(column => [column, !!sortAscending])
            : [],
      },
    ];
    return query;
  });
};

export default buildQuery;
