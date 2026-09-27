const R = window.React;
const hasNew = typeof R.jsx === 'function';
export const Fragment = R.Fragment;
export const jsx = hasNew ? R.jsx : (t, p, k) => {
  const { children, ...rest } = p || {};
  return R.createElement(t, k === undefined ? rest : { ...rest, key: k }, children);
};
export const jsxs = hasNew ? (R.jsxs || R.jsx) : jsx;
export const jsxDEV = jsx;
