// Based on the Apache Superset native filter Select plugin.
import { t } from '@apache-superset/core/translation';
import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

export default class FilterSelectPlugin extends ChartPlugin {
  constructor() {
    const metadata = new ChartMetadata({
      name: t('Select value/label filter'),
      description: t('Select filter plugin using AntD'),
      behaviors: [Behavior.InteractiveChart, Behavior.NativeFilter],
      enableNoResults: false,
      tags: [t('Experimental')],
      thumbnail,
    });

    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./SelectFilterPlugin'),
      metadata,
      transformProps,
    });
  }
}
