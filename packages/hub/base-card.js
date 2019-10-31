"use strict";
// TODO I think we need to move this to it's own node package in the mono repo...
const baseCard = {
    data: {
        id: 'local-hub::@cardstack/base-card',
        type: 'cards',
        attributes: {
            // TODO after we have the ability to perform ember-cli builds on browser assets emitted from cards
            // make sure to move the default card component, template, and CSS into the base card.
            'isolated-js': null,
            'isolated-template': null,
            'isolated-css': null,
            'embedded-js': null,
            'embedded-template': null,
            'embedded-css': null
        },
        relationships: {
            model: { data: { type: 'local-hub::@cardstack/base-card', id: 'local-hub::@cardstack/base-card' } }
        }
    },
    included: [
        {
            id: 'local-hub::@cardstack/base-card',
            type: 'local-hub::@cardstack/base-card'
        }
    ]
};
module.exports = baseCard;
//# sourceMappingURL=base-card.js.map