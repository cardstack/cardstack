module.exports = {
  version: 2,
  snapshot: {
    widths: [375, 1280],
    percyCSS: `
      /* Hide frequently-changing element */
      .boxel-styled-qr-code {
        visibility: hidden !important;
      }
    `,
  },
};
