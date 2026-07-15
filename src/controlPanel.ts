// Based on the Apache Superset native filter Select plugin.
import { t } from '@apache-superset/core/translation';
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

const {
  enableEmptyFilter,
  inverseSelection,
  multiSelect,
  creatable,
  defaultToFirstItem,
  defaultToFirstItemIfSingleOption,
  searchAllOptions,
  sortAscending,
} = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Column'),
              required: true,
            },
          },
        ],
        [
          {
            name: 'displayColumn',
            config: {
              ...sharedControls.groupby,
              // isColumnSelect signals the filter config modal to render this
              // control as a dataset column picker (see getControlItemsMap).
              isColumnSelect: true,
              label: t('Display Column'),
              description: t(
                'Optional. Values from this column are shown as labels in the dropdown. ' +
                  'Filtering is still applied on the Column above.',
              ),
              required: false,
              multi: false,
              validators: [],
              default: null,
            },
          },
        ],
      ],
    },
    {
      label: t('UI Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'sortAscending',
            config: {
              type: 'CheckboxControl',
              renderTrigger: true,
              label: t('Sort ascending'),
              default: sortAscending,
              description: t('Check for sorting ascending'),
            },
          },
        ],
        [
          {
            name: 'creatable',
            config: {
              type: 'CheckboxControl',
              label: t('Allow creation of new values'),
              default: creatable,
              affectsDataMask: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'multiSelect',
            config: {
              type: 'CheckboxControl',
              label: t('Can select multiple values'),
              default: multiSelect,
              resetConfig: true,
              affectsDataMask: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter value is required'),
              default: enableEmptyFilter,
              renderTrigger: true,
              description: t(
                'User must select a value before applying the filter',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultToFirstItem',
            config: {
              type: 'CheckboxControl',
              label: t('Select first filter value by default'),
              default: defaultToFirstItem,
              resetConfig: true,
              affectsDataMask: true,
              renderTrigger: true,
              requiredFirst: true,
              description: t(
                'When using this option, default value cannot be set. Using this option may impact the load times for your dashboard.',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultToFirstItemIfSingleOption',
            config: {
              type: 'CheckboxControl',
              label: t('Select value by default if only one option exists'),
              default: defaultToFirstItemIfSingleOption,
              resetConfig: true,
              affectsDataMask: true,
              renderTrigger: true,
              description: t(
                'Automatically selects the filter value when there is only one available option. Ignored when "Select first filter value by default" is enabled. When using this option, default value cannot be set.',
              ),
            },
          },
        ],
        [
          {
            name: 'inverseSelection',
            config: {
              type: 'CheckboxControl',
              renderTrigger: true,
              affectsDataMask: true,
              label: t('Inverse selection'),
              default: inverseSelection,
              description: t('Exclude selected values'),
            },
          },
        ],
        [
          {
            name: 'searchAllOptions',
            config: {
              type: 'CheckboxControl',
              renderTrigger: true,
              affectsDataMask: true,
              label: t('Dynamically search all filter values'),
              default: searchAllOptions,
              description: t(
                'By default, each filter loads at most 1000 choices at the initial page load. ' +
                  'Check this box if you have more than 1000 filter values and want to enable dynamically ' +
                  'searching that loads filter values as users type (may add stress to your database).',
              ),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      multi: false,
      validators: [validateNonEmpty],
    },
  },
};

export default config;
