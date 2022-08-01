import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { JobTicket } from '@prisma/client';

export default class JobTicketSerializer {
  serialize(model: JobTicket): JSONAPIDocument;
  serialize(model: JobTicket[]): JSONAPIDocument;

  serialize(model: JobTicket | JobTicket[]): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => this.serialize(m).data),
      };
    } else {
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
}

declare module '@cardstack/di' {
  interface KnownServices {
    'job-ticket-serializer': JobTicketSerializer;
  }
}
