import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { JobTicket } from '../../routes/job-tickets';

export default class JobTicketSerializer {
  serialize(model: JobTicket): JSONAPIDocument {
    let attributes: any = {
      'job-type': model.jobType,
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
