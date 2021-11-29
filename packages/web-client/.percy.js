module.exports = {
  version: 2,
  snapshot: {
    widths: [1280],
    percyCSS: `
    /* Break workflow threads out of modal/overflow containers */
    body.has-modal {
      overflow: visible !important;
    }

    .boxel-modal-overlay {
      position: static !important;
    }

    .boxel-modal {
      position: static !important;
      height: auto !important;
    }

    .boxel-thread {
      height: auto !important;
    }

    /* Hide frequently-changing elements: dates, times, and the sidebar application version */
    .boxel-date-divider__date,
    .boxel-thread-message__time,
    .workflow-thread__app-version,
    .styled-qr-code {
      visibility: hidden !important;
    }
  `,
  },
};
