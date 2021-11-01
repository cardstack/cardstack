module.exports = {
  version: 2,
  snapshot: {
    widths: [1280],
    percyCSS: `
    body.has-modal {
      overflow: visible;
    }

    .boxel-modal-overlay {
      position: static;
    }

    .boxel-modal {
      position: static;
      height: auto;
    }

    .boxel-date-divider__date, .boxel-thread-message__time, .workflow-thread__app-version {
      visibility: hidden;
    }

    .boxel-thread {
      height: auto;
    }
  `,
  },
};
