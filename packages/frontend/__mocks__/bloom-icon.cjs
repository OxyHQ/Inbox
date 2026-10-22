// Icon geometry is verified by Bloom; app tests exercise the controls around it.
const Icon = () => null;
module.exports = new Proxy(
  {},
  {
    get: (_target, name) => (name === '__esModule' ? true : Icon),
  },
);
