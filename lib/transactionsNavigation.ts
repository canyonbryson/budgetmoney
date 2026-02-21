type RouteParam = string | string[] | undefined;

function isEnabledFlag(param: RouteParam) {
  return typeof param === 'string' && param === '1';
}

export function resolveTransactionsRouteParams(params: {
  openNew?: RouteParam;
  uncategorizedOnly?: RouteParam;
}) {
  return {
    openNew: isEnabledFlag(params.openNew),
    uncategorizedOnly: isEnabledFlag(params.uncategorizedOnly),
  };
}
