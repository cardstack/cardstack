import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { JobTicket } from '../../routes/job-tickets';

export default class JobTicketSerializer {
  serialize(model: JobTicket): JSONAPIDocument {
    const result = {
      data: {
        id: model.id,
        type: 'job-tickets',
        attributes: {
          state: model.state,
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'job-ticket-serializer': JobTicketSerializer;
  }
}
