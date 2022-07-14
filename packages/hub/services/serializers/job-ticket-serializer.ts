import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { job_tickets } from '@prisma/client';

export default class JobTicketSerializer {
  serialize(model: job_tickets): JSONAPIDocument {
    let attributes: any = {
      state: model.state,
    };

    if (model.result) {
      attributes.result = model.result;
    }

    const result = {
      data: {
        id: model.id,
        type: 'job-tickets',
        attributes,
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
