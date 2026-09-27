// MetalOrb — MetalFx with useMetalBend wired, per design system §5 ambient-play-orb.
// Hooks can't run in a DCLogic class, so the bend lives in this function component.
// Registered on window only once metal-fx has resolved, so hook order is stable.
(function () {
  function define() {
    var MFX = window.MetalFX;
    var h = React.createElement;

    function MetalOrb(props) {
      var bendActive = props.bendActive;
      var children = props.children;
      var rest = {};
      for (var k in props) {
        if (k !== 'bendActive' && k !== 'children') rest[k] = props[k];
      }

      var wrapRef = React.useRef(null);
      // The hook wants the .metal-fx-root itself (it sets data-mfx-bend on it).
      var rootRef = React.useMemo(function () {
        return {
          get current() {
            return wrapRef.current ? wrapRef.current.querySelector('.metal-fx-root') : null;
          }
        };
      }, []);

      var active = bendActive !== false;
      var opts = React.useCallback(function () {
        return Object.assign({}, MFX.BEND_DEFAULTS, { enabled: active });
      }, [active]);

      MFX.useMetalBend(rootRef, opts);

      return h('div', { ref: wrapRef, style: { display: 'inline-flex', lineHeight: 0 } },
        h(MFX.MetalFx, rest, children));
    }

    window.MetalOrb = MetalOrb;
  }

  if (window.MetalFX) define();
  else window.addEventListener('metal-ready', define, { once: true });
})();
