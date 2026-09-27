// VoiceCard — adapts Libraries.dev VoiceBeam to the no-build Design Canvas runtime.
// The schedule drives the beam with a fixed level, so it never requests microphone access.
(function () {
  function define() {
    var VoiceBeam = window.VoiceGlow && window.VoiceGlow.VoiceBeam;
    var h = React.createElement;

    function number(value, fallback) {
      var parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function enabled(value) {
      return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }

    function VoiceCard(props) {
      var children = props.children;
      var wrapStyle = {
        width: '100%', minWidth: 0,
        '--voice-stroke-opacity': 1,
        '--voice-inner-opacity': 0.58,
        '--voice-bloom-opacity': 0.52,
        '--voice-band-opacity': 0.9
      };

      if (!VoiceBeam || !enabled(props.active)) {
        return h('div', { style: wrapStyle }, children);
      }

      return h('div', { style: wrapStyle },
        h(VoiceBeam, {
          level: number(props.level, 0.42),
          type: props.type || 'default',
          colorVariant: props.colorVariant || 'sunset',
          theme: props.theme || 'light',
          strength: number(props.strength, 0.5),
          scale: number(props.scale, 1),
          reach: number(props.reach, 1),
          spread: number(props.spread, 0.9),
          flow: number(props.flow, 48),
          idle: number(props.idle, 0.28),
          bend: number(props.bend, 24),
          coreSize: number(props.coreSize, 1),
          rangeWidth: number(props.rangeWidth, 1),
          glowHeight: number(props.glowHeight, 1),
          innerHeight: number(props.innerHeight, 1),
          bloomHeight: number(props.bloomHeight, 1),
          bandStrength: number(props.bandStrength, 1),
          bandWidth: number(props.bandWidth, 1),
          bandOffset: number(props.bandOffset, -27),
          processing: enabled(props.processing),
          processingDuration: number(props.processingDuration, 1.1),
          processingLevel: number(props.processingLevel, 0.55),
          processingTravel: number(props.processingTravel, 1.55),
          processingCurve: number(props.processingCurve, 2.1),
          active: true,
          paused: enabled(props.paused)
        }, children)
      );
    }

    window.VoiceCard = VoiceCard;
  }

  if (window.VoiceGlow) define();
  else window.addEventListener('voice-ready', define, { once: true });
})();
